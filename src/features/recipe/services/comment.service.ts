import { ObjectId } from 'mongodb';
import { BaseService } from './base.service.js';
import { CommentRepository, type CommentDocument } from '../repositories/comment.repository.js';
import { RecipeRepository } from '../repositories/recipe.repository.js';
import { UserRepository } from '../repositories/user.repository.js';
import { WebSocketService } from './websocket.service.js';
import { NotFoundError, ValidationError, AuthorizationError } from '../types/errors.js';
import logger from '../utils/logger.js';

/**
 * Comment creation DTO
 */
export interface CreateCommentDTO {
  content: string;
  recipeId: string;
  parentId?: string;
}

/**
 * Comment update DTO
 */
export interface UpdateCommentDTO {
  content: string;
}

/**
 * Comment report DTO
 */
export interface ReportCommentDTO {
  reason: string;
  description?: string;
}

/**
 * Service for managing recipe comments
 */
export class CommentService extends BaseService {
  private static instance: CommentService;
  private commentRepository: CommentRepository;
  private recipeRepository: RecipeRepository;
  private userRepository: UserRepository;
  private wsService: WebSocketService;

  private constructor() {
    super();
    this.commentRepository = new CommentRepository();
    this.recipeRepository = new RecipeRepository();
    this.userRepository = new UserRepository();
    this.wsService = WebSocketService.getInstance();
  }

  /**
   * Gets the singleton instance of CommentService
   */
  public static getInstance(): CommentService {
    if (!CommentService.instance) {
      CommentService.instance = new CommentService();
    }
    return CommentService.instance;
  }

  /**
   * Create a new comment
   */
  async createComment(
    userId: ObjectId,
    data: CreateCommentDTO
  ): Promise<CommentDocument> {
    await this.ensureInitialized();

    // Validate recipe exists
    const recipe = await this.recipeRepository.findById(new ObjectId(data.recipeId));
    if (!recipe) {
      throw new NotFoundError('Recipe not found');
    }

    // Validate parent comment if provided
    if (data.parentId) {
      const parentComment = await this.commentRepository.findById(new ObjectId(data.parentId));
      if (!parentComment) {
        throw new NotFoundError('Parent comment not found');
      }
      if (parentComment.recipeId.toString() !== data.recipeId) {
        throw new ValidationError('Parent comment does not belong to the specified recipe');
      }
    }

    // Get user details
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Create comment
    const comment = await this.commentRepository.create({
      content: data.content,
      author: {
        _id: userId,
        name: user.name || user.username
      },
      recipeId: new ObjectId(data.recipeId),
      parentId: data.parentId ? new ObjectId(data.parentId) : undefined,
      status: 'active',
      votes: {
        upvotes: 0,
        downvotes: 0,
        total: 0,
        voters: []
      },
      edited: false,
      replyCount: 0
    });

    // Update parent comment reply count if needed
    if (data.parentId) {
      await this.commentRepository.incrementReplyCount(new ObjectId(data.parentId));
    }

    // Notify subscribers
    this.wsService.notifyRecipeSubscribers(recipe._id, {
      type: 'comment_created',
      data: comment
    });

    return comment;
  }

  /**
   * Update an existing comment
   */
  async updateComment(
    userId: ObjectId,
    commentId: ObjectId,
    data: UpdateCommentDTO
  ): Promise<CommentDocument> {
    await this.ensureInitialized();

    // Get comment
    const comment = await this.commentRepository.findById(commentId);
    if (!comment) {
      throw new NotFoundError('Comment not found');
    }

    // Verify ownership
    if (comment.author._id.toString() !== userId.toString()) {
      throw new AuthorizationError('Not authorized to update this comment');
    }

    // Update comment
    const updated = await this.commentRepository.updateById(commentId, {
      content: data.content,
      edited: true,
      editedAt: new Date()
    });

    if (!updated) {
      throw new NotFoundError('Comment not found');
    }

    // Notify subscribers
    this.wsService.notifyRecipeSubscribers(comment.recipeId, {
      type: 'comment_updated',
      data: updated
    });

    return updated;
  }

  /**
   * Delete a comment
   */
  async deleteComment(userId: ObjectId, commentId: ObjectId): Promise<void> {
    await this.ensureInitialized();

    // Get comment
    const comment = await this.commentRepository.findById(commentId);
    if (!comment) {
      throw new NotFoundError('Comment not found');
    }

    // Verify ownership
    if (comment.author._id.toString() !== userId.toString()) {
      throw new AuthorizationError('Not authorized to delete this comment');
    }

    // Update comment status
    const updated = await this.commentRepository.updateStatus(commentId, 'deleted');
    if (!updated) {
      throw new NotFoundError('Comment not found');
    }

    // Update parent comment reply count if needed
    if (comment.parentId) {
      await this.commentRepository.decrementReplyCount(comment.parentId);
    }

    // Notify subscribers
    this.wsService.notifyRecipeSubscribers(comment.recipeId, {
      type: 'comment_deleted',
      data: { commentId }
    });
  }

  /**
   * Vote on a comment
   */
  async voteComment(
    userId: ObjectId,
    commentId: ObjectId,
    value: 1 | -1
  ): Promise<CommentDocument> {
    await this.ensureInitialized();

    // Get comment
    const comment = await this.commentRepository.findById(commentId);
    if (!comment) {
      throw new NotFoundError('Comment not found');
    }

    // Update vote
    const updated = await this.commentRepository.updateVote(commentId, userId, value);
    if (!updated) {
      throw new NotFoundError('Comment not found');
    }

    // Notify subscribers
    this.wsService.notifyRecipeSubscribers(comment.recipeId, {
      type: 'comment_voted',
      data: {
        commentId,
        userId,
        value
      }
    });

    return updated;
  }

  /**
   * Report a comment
   */
  async reportComment(
    userId: ObjectId,
    commentId: ObjectId,
    data: ReportCommentDTO
  ): Promise<CommentDocument> {
    await this.ensureInitialized();

    // Get comment
    const comment = await this.commentRepository.findById(commentId);
    if (!comment) {
      throw new NotFoundError('Comment not found');
    }

    // Add report
    const updated = await this.commentRepository.reportComment(
      commentId,
      userId,
      data.reason,
      data.description
    );

    if (!updated) {
      throw new NotFoundError('Comment not found');
    }

    // Notify moderators
    this.wsService.notifyModerators({
      type: 'comment_reported',
      data: {
        commentId,
        userId,
        reason: data.reason,
        description: data.description
      }
    });

    return updated;
  }

  /**
   * Get comments for a recipe
   */
  async getRecipeComments(
    recipeId: ObjectId,
    options: {
      parentId?: ObjectId | null;
      sortBy?: 'newest' | 'oldest' | 'votes';
    } = {}
  ): Promise<CommentDocument[]> {
    await this.ensureInitialized();

    return this.commentRepository.search({
      recipeId,
      parentId: options.parentId,
      status: 'active',
      sortBy: options.sortBy
    });
  }

  /**
   * Get comment statistics
   */
  async getStats(): Promise<{
    total: number;
    active: number;
    deleted: number;
    flagged: number;
    withReplies: number;
    avgVotes: number;
  }> {
    await this.ensureInitialized();
    return this.commentRepository.getStats();
  }

  protected override async doInitialize(): Promise<void> {
    // No additional initialization needed
  }
}

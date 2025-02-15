import { ObjectId } from 'mongodb';
import type { Filter, Sort, Document } from 'mongodb';
import { BaseRepository } from '../db/base.repository.js';
import type { MongoDocument } from '../types/mongodb.types.js';

/**
 * Comment document with MongoDB fields
 */
export interface CommentDocument extends MongoDocument {
  content: string;
  author: {
    _id: ObjectId;
    name: string;
  };
  recipeId: ObjectId;
  parentId?: ObjectId;
  status: 'active' | 'deleted' | 'flagged';
  votes: {
    upvotes: number;
    downvotes: number;
    total: number;
    voters: Array<{
      userId: ObjectId;
      value: 1 | -1;
      votedAt: Date;
    }>;
  };
  edited: boolean;
  editedAt?: Date;
  replyCount: number;
  reports?: Array<{
    userId: ObjectId;
    reason: string;
    description?: string;
    reportedAt: Date;
    status: 'pending' | 'reviewed' | 'dismissed';
  }>;
}

/**
 * Comment search parameters
 */
export interface CommentSearchParams {
  recipeId?: ObjectId;
  authorId?: ObjectId;
  parentId?: ObjectId | null;
  status?: CommentDocument['status'];
  hasReplies?: boolean;
  minVotes?: number;
  maxVotes?: number;
  reportStatus?: 'reported' | 'clean';
  sortBy?: 'votes' | 'newest' | 'oldest';
}

/**
 * Repository for managing comments in MongoDB
 */
export class CommentRepository extends BaseRepository<CommentDocument> {
  constructor() {
    super('comments');
  }

  /**
   * Find comments by search parameters
   */
  async search(params: CommentSearchParams): Promise<CommentDocument[]> {
    const filter: Filter<CommentDocument> = {};
    const sort: Sort = { createdAt: -1 };

    // Filter by recipe
    if (params.recipeId) {
      filter.recipeId = params.recipeId;
    }

    // Filter by author
    if (params.authorId) {
      filter['author._id'] = params.authorId;
    }

    // Filter by parent (top-level or replies)
    if (params.parentId === null) {
      filter.parentId = { $exists: false };
    } else if (params.parentId) {
      filter.parentId = params.parentId;
    }

    // Filter by status
    if (params.status) {
      filter.status = params.status;
    }

    // Filter by reply count
    if (params.hasReplies !== undefined) {
      filter.replyCount = params.hasReplies ? { $gt: 0 } : 0;
    }

    // Filter by vote count
    if (params.minVotes !== undefined) {
      filter['votes.total'] = { $gte: params.minVotes };
    }
    if (params.maxVotes !== undefined) {
      filter['votes.total'] = { ...filter['votes.total'], $lte: params.maxVotes };
    }

    // Filter by report status
    if (params.reportStatus) {
      if (params.reportStatus === 'reported') {
        filter.reports = { $exists: true, $not: { $size: 0 } };
      } else {
        filter.reports = { $exists: false };
      }
    }

    // Apply sorting
    if (params.sortBy) {
      switch (params.sortBy) {
        case 'votes':
          sort['votes.total'] = -1;
          break;
        case 'newest':
          sort.createdAt = -1;
          break;
        case 'oldest':
          sort.createdAt = 1;
          break;
      }
    }

    return this.find(filter, { sort });
  }

  /**
   * Find comments by recipe ID
   */
  async findByRecipe(recipeId: ObjectId): Promise<CommentDocument[]> {
    return this.find({ recipeId });
  }

  /**
   * Find comments by author ID
   */
  async findByAuthor(authorId: ObjectId): Promise<CommentDocument[]> {
    return this.find({ 'author._id': authorId });
  }

  /**
   * Find replies to a comment
   */
  async findReplies(commentId: ObjectId): Promise<CommentDocument[]> {
    return this.find({ parentId: commentId });
  }

  /**
   * Update comment vote
   */
  async updateVote(
    commentId: ObjectId,
    userId: ObjectId,
    value: 1 | -1
  ): Promise<CommentDocument | null> {
    const now = new Date();

    // Remove any existing vote
    await this.collection.updateOne(
      { _id: commentId },
      {
        $pull: {
          'votes.voters': { userId }
        }
      }
    );

    // Add new vote and update totals
    const result = await this.collection.findOneAndUpdate(
      { _id: commentId },
      {
        $push: {
          'votes.voters': {
            userId,
            value,
            votedAt: now
          }
        },
        $inc: {
          'votes.total': value,
          'votes.upvotes': value === 1 ? 1 : 0,
          'votes.downvotes': value === -1 ? 1 : 0
        },
        $set: {
          updatedAt: now
        }
      },
      { returnDocument: 'after' }
    );

    return result.value;
  }

  /**
   * Report a comment
   */
  async reportComment(
    commentId: ObjectId,
    userId: ObjectId,
    reason: string,
    description?: string
  ): Promise<CommentDocument | null> {
    const result = await this.collection.findOneAndUpdate(
      { _id: commentId },
      {
        $push: {
          reports: {
            userId,
            reason,
            description,
            reportedAt: new Date(),
            status: 'pending'
          }
        },
        $set: {
          status: 'flagged',
          updatedAt: new Date()
        }
      },
      { returnDocument: 'after' }
    );

    return result.value;
  }

  /**
   * Update comment status
   */
  async updateStatus(
    commentId: ObjectId,
    status: CommentDocument['status']
  ): Promise<CommentDocument | null> {
    const result = await this.collection.findOneAndUpdate(
      { _id: commentId },
      {
        $set: {
          status,
          updatedAt: new Date()
        }
      },
      { returnDocument: 'after' }
    );
    return result.value;
  }

  /**
   * Increment reply count
   */
  async incrementReplyCount(commentId: ObjectId): Promise<void> {
    await this.collection.updateOne(
      { _id: commentId },
      {
        $inc: { replyCount: 1 },
        $set: { updatedAt: new Date() }
      }
    );
  }

  /**
   * Decrement reply count
   */
  async decrementReplyCount(commentId: ObjectId): Promise<void> {
    await this.collection.updateOne(
      { _id: commentId },
      {
        $inc: { replyCount: -1 },
        $set: { updatedAt: new Date() }
      }
    );
  }

  /**
   * Get comment stats
   */
  async getStats(): Promise<{
    total: number;
    active: number;
    deleted: number;
    flagged: number;
    withReplies: number;
    avgVotes: number;
  }> {
    const pipeline = [
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          active: {
            $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] }
          },
          deleted: {
            $sum: { $cond: [{ $eq: ['$status', 'deleted'] }, 1, 0] }
          },
          flagged: {
            $sum: { $cond: [{ $eq: ['$status', 'flagged'] }, 1, 0] }
          },
          withReplies: {
            $sum: { $cond: [{ $gt: ['$replyCount', 0] }, 1, 0] }
          },
          totalVotes: { $sum: '$votes.total' }
        }
      },
      {
        $project: {
          _id: 0,
          total: 1,
          active: 1,
          deleted: 1,
          flagged: 1,
          withReplies: 1,
          avgVotes: {
            $cond: [
              { $eq: ['$total', 0] },
              0,
              { $divide: ['$totalVotes', '$total'] }
            ]
          }
        }
      }
    ];

    const [stats] = await this.collection
      .aggregate<{
        total: number;
        active: number;
        deleted: number;
        flagged: number;
        withReplies: number;
        avgVotes: number;
      }>(pipeline)
      .toArray();

    return stats || {
      total: 0,
      active: 0,
      deleted: 0,
      flagged: 0,
      withReplies: 0,
      avgVotes: 0
    };
  }
} 
import { ObjectId } from 'mongodb';
import { DatabaseService } from '../../../core/database/database.service.js';
import { NotFoundError, ValidationError } from '../../../core/errors/index.js';
import type {
  Comment,
  Like,
  Share,
  Follow,
  Activity,
  Notification,
  CreateCommentDTO,
  UpdateCommentDTO,
  CreateShareDTO,
  CreateNotificationDTO
} from '../types/social.types.js';
import type { PaginationParams, PaginatedResponse } from '../../../shared/types/common.types.js';

export class SocialService {
  private readonly db: DatabaseService;
  private readonly collections = {
    comments: 'comments',
    likes: 'likes',
    shares: 'shares',
    follows: 'follows',
    activities: 'activities',
    notifications: 'notifications'
  };

  constructor(db: DatabaseService) {
    this.db = db;
  }

  // Comment methods
  async createComment(data: CreateCommentDTO): Promise<Comment> {
    const comment = await this.db.insertOne<Comment>(this.collections.comments, {
      ...data,
      likes: 0,
      replies: [],
      isEdited: false,
      status: 'active'
    });

    await this.createActivity({
      userId: data.userId,
      type: 'comment',
      targetId: data.targetId,
      targetType: data.targetType,
      metadata: { commentId: comment._id }
    });

    return comment;
  }

  async getComment(commentId: ObjectId): Promise<Comment> {
    const comment = await this.db.findOne<Comment>(
      this.collections.comments,
      { _id: commentId }
    );

    if (!comment) {
      throw new NotFoundError('Comment not found');
    }

    return comment;
  }

  async updateComment(commentId: ObjectId, data: UpdateCommentDTO): Promise<Comment> {
    const comment = await this.db.findOneAndUpdate<Comment>(
      this.collections.comments,
      { _id: commentId },
      { $set: { ...data, isEdited: true } }
    );

    if (!comment) {
      throw new NotFoundError('Comment not found');
    }

    return comment;
  }

  async deleteComment(commentId: ObjectId): Promise<void> {
    const result = await this.db.updateOne(
      this.collections.comments,
      { _id: commentId },
      { $set: { status: 'deleted' } }
    );

    if (!result.matchedCount) {
      throw new NotFoundError('Comment not found');
    }
  }

  // Like methods
  async toggleLike(userId: ObjectId, targetId: ObjectId, targetType: Like['targetType']): Promise<boolean> {
    const existingLike = await this.db.findOne<Like>(
      this.collections.likes,
      { userId, targetId, targetType }
    );

    if (existingLike) {
      await this.db.deleteOne(this.collections.likes, { _id: existingLike._id });
      return false;
    }

    await this.db.insertOne<Like>(this.collections.likes, {
      userId,
      targetId,
      targetType
    });

    await this.createActivity({
      userId,
      type: 'like',
      targetId,
      targetType,
    });

    return true;
  }

  // Share methods
  async createShare(data: CreateShareDTO): Promise<Share> {
    const share = await this.db.insertOne<Share>(this.collections.shares, data);

    await this.createActivity({
      userId: data.userId,
      type: 'share',
      targetId: data.targetId,
      targetType: data.targetType,
      metadata: { platform: data.platform }
    });

    return share;
  }

  // Follow methods
  async toggleFollow(followerId: ObjectId, followedId: ObjectId): Promise<boolean> {
    if (followerId.equals(followedId)) {
      throw new ValidationError('Users cannot follow themselves');
    }

    const existingFollow = await this.db.findOne<Follow>(
      this.collections.follows,
      { followerId, followedId }
    );

    if (existingFollow) {
      await this.db.deleteOne(this.collections.follows, { _id: existingFollow._id });
      return false;
    }

    await this.db.insertOne<Follow>(this.collections.follows, {
      followerId,
      followedId,
      status: 'accepted'
    });

    await this.createActivity({
      userId: followerId,
      type: 'follow',
      targetId: followedId,
      targetType: 'user'
    });

    return true;
  }

  // Activity methods
  private async createActivity(data: Omit<Activity, keyof MongoDocument>): Promise<void> {
    await this.db.insertOne(this.collections.activities, data);
    await this.createNotification(this.buildNotification(data));
  }

  // Notification methods
  private async createNotification(data: CreateNotificationDTO): Promise<void> {
    await this.db.insertOne(this.collections.notifications, {
      ...data,
      status: 'unread'
    });
  }

  private buildNotification(activity: Omit<Activity, keyof MongoDocument>): CreateNotificationDTO {
    return {
      userId: activity.targetType === 'user' ? activity.targetId : activity.targetId,
      type: activity.type,
      actorId: activity.userId,
      targetId: activity.targetId,
      targetType: activity.targetType,
      metadata: activity.metadata
    };
  }

  // Getter methods
  async getCommentsByTarget(
    targetId: ObjectId,
    targetType: Comment['targetType'],
    params: PaginationParams
  ): Promise<PaginatedResponse<Comment>> {
    return this.db.findPaginated<Comment>(
      this.collections.comments,
      { targetId, targetType, status: 'active' },
      params
    );
  }

  async getNotifications(
    userId: ObjectId,
    params: PaginationParams
  ): Promise<PaginatedResponse<Notification>> {
    return this.db.findPaginated<Notification>(
      this.collections.notifications,
      { userId },
      params
    );
  }

  async getFollowers(
    userId: ObjectId,
    params: PaginationParams
  ): Promise<PaginatedResponse<Follow>> {
    return this.db.findPaginated<Follow>(
      this.collections.follows,
      { followedId: userId, status: 'accepted' },
      params
    );
  }

  async getFollowing(
    userId: ObjectId,
    params: PaginationParams
  ): Promise<PaginatedResponse<Follow>> {
    return this.db.findPaginated<Follow>(
      this.collections.follows,
      { followerId: userId, status: 'accepted' },
      params
    );
  }
}

// Export singleton instance
export const socialService = new SocialService(DatabaseService.getInstance()); 
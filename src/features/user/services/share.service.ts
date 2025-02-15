;
;
import type { Collection } from 'mongodb';
import type { Recipe } from '../types/express.js';
import { ObjectId } from 'mongodb';;;;
import { DatabaseService } from '../db/database.service.js';;
import { NotificationManagerService } from '../notification-manager.service.js';;
import { DatabaseError, NotFoundError, ForbiddenError } from '../utils/errors.js';;
import logger from '../utils/logger.js';
import { NotificationChannel } from '../types.js';;

export interface RecipeShare {
  _id?: ObjectId;
  recipeId: ObjectId;
  sharedBy: ObjectId;
  sharedWith: ObjectId;
  message?: string;
  visibility: 'public' | 'private';
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: Date;
  updatedAt: Date;
}

export interface ShareRecipeInput {
  recipeId: ObjectId;
  sharedBy: ObjectId;
  sharedWith: ObjectId;
  message?: string;
  visibility?: 'public' | 'private';
}

export interface ShareRecipeMultipleInput {
  recipeId: ObjectId;
  sharedBy: ObjectId;
  sharedWith: ObjectId[];
  message?: string;
  visibility?: 'public' | 'private';
}

export class ShareService {
  private static instance: ShareService;
  private initialized: boolean = false;
  private db: DatabaseService;
  private notificationService: NotificationManagerService;

  private constructor() {
    this.db = DatabaseService.getInstance();
    this.notificationService = NotificationManagerService.getInstance();
  }

  public static getInstance(): ShareService {
    if (!ShareService.instance) {
      ShareService.instance = new ShareService();
    }
    return ShareService.instance;
  }

  private async initialize(): Promise<void> {
    if (this.initialized) return;
    await this.db.connect();
    this.initialized = true;
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  async shareRecipe(input: ShareRecipeInput): Promise<RecipeShare> {
    await this.ensureInitialized();

    const share: RecipeShare = {
      recipeId: input.recipeId,
      sharedBy: input.sharedBy,
      sharedWith: input.sharedWith,
      message: input.message,
      visibility: input.visibility || 'private',
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    try {
      const result = await this.db.getCollection('recipe_shares').insertOne(share);
      
      // Send notification
      await this.notificationService.sendNotification({
        userId: input.sharedWith,
        type: 'recipe_share',
        title: 'Recipe Shared',
        message: 'Someone shared a recipe with you',
        data: {
          recipeId: input.recipeId,
          sharedBy: input.sharedBy,
        },
        channels: [NotificationChannel.IN_APP],
      });

      return { ...share, _id: result.insertedId };
    } catch (error) {
      logger.error('Failed to share recipe:', error);
      throw new DatabaseError('Failed to share recipe');
    }
  }

  async shareRecipeWithMultiple(input: ShareRecipeMultipleInput): Promise<RecipeShare[]> {
    await this.ensureInitialized();

    const shares: RecipeShare[] = input.sharedWith.map(userId => ({
      recipeId: input.recipeId,
      sharedBy: input.sharedBy,
      sharedWith: userId,
      message: input.message,
      visibility: input.visibility || 'private',
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    try {
      const result = await this.db.getCollection('recipe_shares').insertMany(shares);
      
      // Send notifications
      await Promise.all(
        input.sharedWith.map(userId =>
          this.notificationService.sendNotification({
            userId,
            type: 'recipe_share',
            title: 'Recipe Shared',
            message: 'Someone shared a recipe with you',
            data: {
              recipeId: input.recipeId,
              sharedBy: input.sharedBy,
            },
            channels: [NotificationChannel.IN_APP],
          })
        )
      );

      return shares.map((share: any, index: any) => ({
        ...share,
        _id: result.insertedIds[index],
      }));
    } catch (error) {
      logger.error('Failed to share recipe with multiple users:', error);
      throw new DatabaseError('Failed to share recipe with multiple users');
    }
  }

  async getRecipeShares(recipeId: ObjectId, userId: ObjectId, isAuthor: boolean): Promise<RecipeShare[]> {
    await this.ensureInitialized();

    const query = isAuthor
      ? { recipeId }
      : {
          recipeId,
          $or: [{ sharedBy: userId }, { sharedWith: userId }],
        };

    try {
      const shares = await this.db
        .getCollection<RecipeShare>('recipe_shares')
        .aggregate<RecipeShare>([
          { $match: query },
          {
            $lookup: {
              from: 'users',
              localField: 'sharedBy',
              foreignField: '_id',
              as: 'sharedByUser',
            },
          },
          {
            $lookup: {
              from: 'users',
              localField: 'sharedWith',
              foreignField: '_id',
              as: 'sharedWithUser',
            },
          },
          { $unwind: '$sharedByUser' },
          { $unwind: '$sharedWithUser' },
          {
            $project: {
              _id: 1,
              recipeId: 1,
              message: 1,
              visibility: 1,
              status: 1,
              createdAt: 1,
              sharedBy: {
                _id: '$sharedByUser._id',
                name: '$sharedByUser.name',
              },
              sharedWith: {
                _id: '$sharedWithUser._id',
                name: '$sharedWithUser.name',
              },
            },
          },
          { $sort: { createdAt: -1 } },
        ])
        .toArray();

      return shares;
    } catch (error) {
      logger.error('Failed to get recipe shares:', error);
      throw new DatabaseError('Failed to get recipe shares');
    }
  }

  async acceptShare(shareId: ObjectId, userId: ObjectId): Promise<void> {
    await this.ensureInitialized();

    try {
      const result = await this.db.getCollection('recipe_shares').findOneAndUpdate(
        {
          _id: shareId,
          sharedWith: userId,
          status: 'pending',
        },
        {
          $set: {
            status: 'accepted',
            updatedAt: new Date(),
          },
        },
        { returnDocument: 'after' }
      );

      if (!result.value) {
        throw new NotFoundError('Share not found or already processed');
      }

      // Send notification to sharer
      await this.notificationService.sendNotification({
        userId: result.value.sharedBy,
        type: 'recipe_share',
        title: 'Share Accepted',
        message: 'Someone accepted your recipe share',
        data: {
          recipeId: result.value.recipeId,
          shareId: result.value._id,
        },
        channels: [NotificationChannel.IN_APP],
      });
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      logger.error('Failed to accept share:', error);
      throw new DatabaseError('Failed to accept share');
    }
  }

  async rejectShare(shareId: ObjectId, userId: ObjectId): Promise<void> {
    await this.ensureInitialized();

    try {
      const result = await this.db.getCollection('recipe_shares').findOneAndUpdate(
        {
          _id: shareId,
          sharedWith: userId,
          status: 'pending',
        },
        {
          $set: {
            status: 'rejected',
            updatedAt: new Date(),
          },
        },
        { returnDocument: 'after' }
      );

      if (!result.value) {
        throw new NotFoundError('Share not found or already processed');
      }

      // Send notification to sharer
      await this.notificationService.sendNotification({
        userId: result.value.sharedBy,
        type: 'recipe_share',
        title: 'Share Rejected',
        message: 'Someone rejected your recipe share',
        data: {
          recipeId: result.value.recipeId,
          shareId: result.value._id,
        },
        channels: [NotificationChannel.IN_APP],
      });
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      logger.error('Failed to reject share:', error);
      throw new DatabaseError('Failed to reject share');
    }
  }
} 
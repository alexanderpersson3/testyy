import { Collection, ObjectId, WithId } from 'mongodb';
import { getDb } from '../config/db';
import SubscriptionManager from './subscription-manager';
import { Recipe, RecipeDocument } from '../types/recipe';

export interface OfflineStorageOptions {
  maxItems?: number;
  expirationDays?: number;
}

export interface OfflineItem {
  userId: ObjectId;
  recipeId: ObjectId;
  savedAt: Date;
  expiresAt: Date;
  syncStatus: 'pending' | 'synced' | 'error';
}

export class OfflineStorageService {
  private readonly DEFAULT_MAX_ITEMS = 100;
  private readonly DEFAULT_EXPIRATION_DAYS = 30;

  constructor(
    private readonly subscriptionManager: {
      hasFeatureAccess(userId: string, feature: string): Promise<boolean>;
    },
    private readonly options: OfflineStorageOptions = {}
  ) {
    this.options.maxItems = options.maxItems || this.DEFAULT_MAX_ITEMS;
    this.options.expirationDays = options.expirationDays || this.DEFAULT_EXPIRATION_DAYS;
  }

  async markRecipeForOffline(userId: string, recipeId: string): Promise<boolean> {
    try {
      const db = await getDb();
      const hasAccess = await this.verifyOfflineAccess(userId);
      
      if (!hasAccess) {
        throw new Error('Premium subscription required for offline access');
      }

      const offlineItem: OfflineItem = {
        userId: new ObjectId(userId),
        recipeId: new ObjectId(recipeId),
        savedAt: new Date(),
        expiresAt: this.calculateExpirationDate(),
        syncStatus: 'pending'
      };

      await db.collection<OfflineItem>('offline_items').insertOne(offlineItem);
      return true;
    } catch (error) {
      console.error('Error marking recipe for offline:', error);
      throw error;
    }
  }

  async getOfflineRecipes(userId: string): Promise<RecipeDocument[]> {
    try {
      const db = await getDb();
      const offlineItems = await db.collection<OfflineItem>('offline_items')
        .find({
          userId: new ObjectId(userId),
          expiresAt: { $gt: new Date() }
        })
        .toArray();

      const recipeIds = offlineItems.map(item => item.recipeId);
      
      const recipes = await db.collection<RecipeDocument>('recipes')
        .find({ _id: { $in: recipeIds } })
        .toArray();

      return recipes;
    } catch (error) {
      console.error('Error getting offline recipes:', error);
      throw error;
    }
  }

  async removeOfflineRecipe(userId: string, recipeId: string): Promise<boolean> {
    try {
      const db = await getDb();
      const result = await db.collection<OfflineItem>('offline_items').deleteOne({
        userId: new ObjectId(userId),
        recipeId: new ObjectId(recipeId)
      });

      return result.deletedCount > 0;
    } catch (error) {
      console.error('Error removing offline recipe:', error);
      throw error;
    }
  }

  async cleanupExpiredItems(): Promise<number> {
    try {
      const db = await getDb();
      const result = await db.collection<OfflineItem>('offline_items').deleteMany({
        expiresAt: { $lt: new Date() }
      });

      return result.deletedCount;
    } catch (error) {
      console.error('Error cleaning up expired items:', error);
      throw error;
    }
  }

  private async verifyOfflineAccess(userId: string): Promise<boolean> {
    try {
      return await this.subscriptionManager.hasFeatureAccess(userId, 'offline_access');
    } catch (error) {
      console.error('Error verifying offline access:', error);
      return false;
    }
  }

  private calculateExpirationDate(): Date {
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + this.options.expirationDays!);
    return expirationDate;
  }
} 
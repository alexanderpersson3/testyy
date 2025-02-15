import { promises as fs } from 'fs';;
;
;
import type { Collection } from 'mongodb';
import type { ObjectId, WithId as MongoWithId } from '../types/express.js';
import { DatabaseService } from '../db/database.service.js';;
import logger from '../utils/logger.js';
import { NotificationManagerService } from '../notification-manager.service.js';;
import type { CollectionInsights } from '../types/express.js';
import { CookingStats, UsageMetrics, AnalyticsPreferences, AnalyticsSnapshot, PersonalizedTip,  } from '../types/analytics.js';;
import type { Recipe } from '../types/express.js';
;
import type { WithId } from '../types/express.js';

export class UserAnalyticsService {
  private static instance: UserAnalyticsService;
  private notificationService: NotificationManagerService;
  private db: DatabaseService;

  private constructor() {
    this.notificationService = NotificationManagerService.getInstance();
    this.db = DatabaseService.getInstance();
  }

  static getInstance(): UserAnalyticsService {
    if (!UserAnalyticsService.instance) {
      UserAnalyticsService.instance = new UserAnalyticsService();
    }
    return UserAnalyticsService.instance;
  }

  /**
   * Get user's cooking stats
   */
  async getCookingStats(userId: string): Promise<CookingStats> {
    const cookingStats = await this.db
      .getCollection<CookingStats>('cooking_stats')
      .findOne({ userId: new ObjectId(userId) });

    if (!cookingStats) {
      const newStats: WithId<CookingStats> = {
        _id: new ObjectId(),
        userId: new ObjectId(userId),
        totalRecipesCooked: 0,
        totalCookingTime: 0,
        favoriteRecipes: [],
        cuisinePreferences: {},
        difficultyDistribution: {
          easy: 0,
          medium: 0,
          hard: 0
        },
        lastUpdated: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const result = await this.db
        .getCollection<CookingStats>('cooking_stats')
        .insertOne(newStats as CookingStats);

      return {
        ...newStats,
        _id: result.insertedId,
        userId: new ObjectId(userId),
        totalRecipesCooked: 0,
        totalCookingTime: 0,
        favoriteRecipes: [],
        cuisinePreferences: {},
        difficultyDistribution: {
          easy: 0,
          medium: 0,
          hard: 0
        },
        lastUpdated: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      };
    }

    return cookingStats;
  }

  /**
   * Update user's cooking stats
   */
  async updateCookingStats(userId: string, stats: Partial<CookingStats>): Promise<WithId<CookingStats>> {
    const result = await this.db
      .getCollection<CookingStats>('cooking_stats')
      .findOneAndUpdate(
        { userId: new ObjectId(userId) },
        {
          $set: {
            ...stats,
            lastUpdated: new Date(),
            updatedAt: new Date()
          }
        },
        { returnDocument: 'after', upsert: true }
      );

    if (!result) {
      const defaultStats: WithId<CookingStats> = {
        _id: new ObjectId(),
        userId: new ObjectId(userId),
        totalRecipesCooked: 0,
        totalCookingTime: 0,
        favoriteRecipes: [],
        cuisinePreferences: {},
        difficultyDistribution: {
          easy: 0,
          medium: 0,
          hard: 0
        },
        lastUpdated: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      };
      return defaultStats;
    }

    return result as unknown as WithId<CookingStats>;
  }

  /**
   * Get collection insights
   */
  async getCollectionInsights(userId: string, collectionId: string): Promise<CollectionInsights> {
    const collectionInsights = await this.db
      .getCollection<CollectionInsights>('collection_insights')
      .findOne({
        userId: new ObjectId(userId),
        collectionId: new ObjectId(collectionId)
      });

    if (!collectionInsights) {
      const newInsights: WithId<CollectionInsights> = {
        _id: new ObjectId(),
        userId: new ObjectId(userId),
        collectionId: new ObjectId(collectionId),
        recipeCount: 0,
        totalCookTime: 0,
        averageDifficulty: 0,
        cuisineDistribution: {},
        lastUpdated: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const result = await this.db
        .getCollection<CollectionInsights>('collection_insights')
        .insertOne(newInsights as CollectionInsights);

      return {
        ...newInsights,
        _id: result.insertedId,
        userId: new ObjectId(userId),
        collectionId: new ObjectId(collectionId),
        recipeCount: 0,
        totalCookTime: 0,
        averageDifficulty: 0,
        cuisineDistribution: {},
        lastUpdated: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      };
    }

    return collectionInsights;
  }

  /**
   * Get usage metrics
   */
  async getUsageMetrics(userId: string, period: 'day' | 'week' | 'month'): Promise<UsageMetrics> {
    const usageMetrics = await this.db
      .getCollection<UsageMetrics>('usage_metrics')
      .findOne({
        userId: new ObjectId(userId),
        period
      });

    if (!usageMetrics) {
      const newMetrics: WithId<UsageMetrics> = {
        _id: new ObjectId(),
        userId: new ObjectId(userId),
        period,
        recipeViews: 0,
        recipeSaves: 0,
        recipeShares: 0,
        collectionViews: 0,
        searchQueries: 0,
        filterUsage: {},
        lastUpdated: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const result = await this.db
        .getCollection<UsageMetrics>('usage_metrics')
        .insertOne(newMetrics as UsageMetrics);

      return {
        ...newMetrics,
        _id: result.insertedId,
        userId: new ObjectId(userId),
        period,
        recipeViews: 0,
        recipeSaves: 0,
        recipeShares: 0,
        collectionViews: 0,
        searchQueries: 0,
        filterUsage: {},
        lastUpdated: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      };
    }

    return usageMetrics;
  }

  /**
   * Get analytics preferences
   */
  async getAnalyticsPreferences(userId: string): Promise<AnalyticsPreferences> {
    let prefs = await this.db
      .getCollection<AnalyticsPreferences>('analytics_preferences')
      .findOne({ userId: new ObjectId(userId) });

    if (!prefs) {
      const defaultPrefs: WithId<AnalyticsPreferences> = {
        _id: new ObjectId(),
        userId: new ObjectId(userId),
        dataCollection: {
          cookingStats: true,
          collectionInsights: true,
          usageMetrics: true,
          personalizedTips: true
        },
        notifications: {
          weeklyReport: true,
          monthlyInsights: true,
          achievementAlerts: true,
          trendAlerts: true
        },
        privacySettings: {
          shareStats: false,
          showInLeaderboards: false,
          allowComparison: false,
          anonymizeData: true
        },
        reportSettings: {
          format: 'detailed',
          frequency: 'weekly'
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const result = await this.db
        .getCollection<AnalyticsPreferences>('analytics_preferences')
        .insertOne(defaultPrefs as AnalyticsPreferences);

      prefs = {
        ...defaultPrefs,
        _id: result.insertedId,
        userId: new ObjectId(userId),
        dataCollection: {
          cookingStats: true,
          collectionInsights: true,
          usageMetrics: true,
          personalizedTips: true
        },
        notifications: {
          weeklyReport: true,
          monthlyInsights: true,
          achievementAlerts: true,
          trendAlerts: true
        },
        privacySettings: {
          shareStats: false,
          showInLeaderboards: false,
          allowComparison: false,
          anonymizeData: true
        },
        reportSettings: {
          format: 'detailed',
          frequency: 'weekly'
        },
        createdAt: new Date(),
        updatedAt: new Date()
      } as unknown as AnalyticsPreferences;
    }

    return prefs;
  }

  /**
   * Update analytics preferences
   */
  async updateAnalyticsPreferences(
    userId: string,
    preferences: Partial<AnalyticsPreferences>
  ): Promise<WithId<AnalyticsPreferences>> {
    const result = await this.db
      .getCollection<AnalyticsPreferences>('analytics_preferences')
      .findOneAndUpdate(
        { userId: new ObjectId(userId) },
        {
          $set: {
            ...preferences,
            updatedAt: new Date()
          }
        },
        { returnDocument: 'after', upsert: true }
      );

    if (!result) {
      throw new Error('Failed to update analytics preferences');
    }

    return result as unknown as WithId<AnalyticsPreferences>;
  }

  /**
   * Get personalized tips
   */
  async getPersonalizedTips(userId: string): Promise<PersonalizedTip[]> {
    const userObjectId = new ObjectId(userId);

    // Get user's preferences
    const prefs = await this.getAnalyticsPreferences(userId);
    if (!prefs.dataCollection.personalizedTips) {
      return [];
    }

    // Get active tips
    return this.db
      .getCollection<PersonalizedTip>('personalized_tips')
      .find({
        userId: userObjectId,
        $or: [{ expiresAt: { $exists: false } }, { expiresAt: { $gt: new Date() } }],
      })
      .sort({ priority: -1, createdAt: -1 })
      .toArray();
  }

  /**
   * Create analytics snapshot
   */
  async createSnapshot(
    userId: string,
    type: AnalyticsSnapshot['type']
  ): Promise<WithId<AnalyticsSnapshot>> {
    const userObjectId = new ObjectId(userId);
    const now = new Date();
    const period = this.calculatePeriod(type, now);

    // Get current stats
    const [cookingStats, usageMetrics] = await Promise.all([
      this.getCookingStats(userId),
      this.getUsageMetrics(userId, type === 'daily' ? 'day' : type === 'weekly' ? 'week' : 'month'),
    ]);

    // Get collection insights
    const collections = await this.db
      .getCollection<WithId<Collection>>('collections')
      .find({ userId: new ObjectId(userId) })
      .toArray();

    const collectionInsights = await Promise.all(
      collections.map(c => this.getCollectionInsights(userId, c._id.toString()))
    );

    const snapshot: WithId<AnalyticsSnapshot> = {
      _id: new ObjectId(),
      userId: new ObjectId(userId),
      type,
      period: {
        start: new Date(),
        end: new Date()
      },
      cookingStats,
      collectionInsights,
      usageMetrics,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Save snapshot
    const result = await this.db.getCollection<AnalyticsSnapshot>('analytics_snapshots').insertOne(snapshot);

    return {
      ...snapshot,
      _id: result.insertedId
    };
  }

  private calculatePeriod(type: AnalyticsSnapshot['type'], date: Date): { start: Date; end: Date } {
    const start = new Date(date);
    const end = new Date(date);

    switch (type) {
      case 'daily':
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        break;
      case 'weekly':
        start.setDate(start.getDate() - start.getDay());
        start.setHours(0, 0, 0, 0);
        end.setDate(end.getDate() + (6 - end.getDay()));
        end.setHours(23, 59, 59, 999);
        break;
      case 'monthly':
        start.setDate(1);
        start.setHours(0, 0, 0, 0);
        end.setMonth(end.getMonth() + 1, 0);
        end.setHours(23, 59, 59, 999);
        break;
    }

    return { start, end };
  }

  private calculateAverageDifficulty(recipes: Recipe[]): number {
    const difficultyMap = { easy: 1, medium: 2, hard: 3 };
    const sum = recipes.reduce((acc: any, r: any) => acc + (difficultyMap[r.difficulty] || 0), 0);
    return recipes.length > 0 ? sum / recipes.length : 0;
  }

  private calculateCuisineDistribution(recipes: Recipe[]): Record<string, number> {
    const distribution: Record<string, number> = {};
    recipes.forEach(r => {
      // Initialize or increment the count for this cuisine
      const cuisine = r.cuisine || 'Other';
      distribution[cuisine] = (distribution[cuisine] || 0) + 1;
    });
    return distribution;
  }
}

import * as fs from 'fs';
import { DatabaseService } from '../db/database.service.js';
import logger from '../utils/logger.js';
import { NotificationManagerService } from '../notification-manager.service.js';
import { CookingStats, UsageMetrics, AnalyticsPreferences, AnalyticsSnapshot, PersonalizedTip, } from '../types/analytics.js';
export class UserAnalyticsService {
    constructor() {
        this.notificationService = NotificationManagerService.getInstance();
        this.db = DatabaseService.getInstance();
    }
    static getInstance() {
        if (!UserAnalyticsService.instance) {
            UserAnalyticsService.instance = new UserAnalyticsService();
        }
        return UserAnalyticsService.instance;
    }
    /**
     * Get user's cooking stats
     */
    async getCookingStats(userId) {
        const cookingStats = await this.db
            .getCollection('cooking_stats')
            .findOne({ userId: new ObjectId(userId) });
        if (!cookingStats) {
            const newStats = {
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
                .getCollection('cooking_stats')
                .insertOne(newStats);
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
    async updateCookingStats(userId, stats) {
        const result = await this.db
            .getCollection('cooking_stats')
            .findOneAndUpdate({ userId: new ObjectId(userId) }, {
            $set: {
                ...stats,
                lastUpdated: new Date(),
                updatedAt: new Date()
            }
        }, { returnDocument: 'after', upsert: true });
        if (!result) {
            const defaultStats = {
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
        return result;
    }
    /**
     * Get collection insights
     */
    async getCollectionInsights(userId, collectionId) {
        const collectionInsights = await this.db
            .getCollection('collection_insights')
            .findOne({
            userId: new ObjectId(userId),
            collectionId: new ObjectId(collectionId)
        });
        if (!collectionInsights) {
            const newInsights = {
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
                .getCollection('collection_insights')
                .insertOne(newInsights);
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
    async getUsageMetrics(userId, period) {
        const usageMetrics = await this.db
            .getCollection('usage_metrics')
            .findOne({
            userId: new ObjectId(userId),
            period
        });
        if (!usageMetrics) {
            const newMetrics = {
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
                .getCollection('usage_metrics')
                .insertOne(newMetrics);
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
    async getAnalyticsPreferences(userId) {
        let prefs = await this.db
            .getCollection('analytics_preferences')
            .findOne({ userId: new ObjectId(userId) });
        if (!prefs) {
            const defaultPrefs = {
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
                .getCollection('analytics_preferences')
                .insertOne(defaultPrefs);
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
            };
        }
        return prefs;
    }
    /**
     * Update analytics preferences
     */
    async updateAnalyticsPreferences(userId, preferences) {
        const result = await this.db
            .getCollection('analytics_preferences')
            .findOneAndUpdate({ userId: new ObjectId(userId) }, {
            $set: {
                ...preferences,
                updatedAt: new Date()
            }
        }, { returnDocument: 'after', upsert: true });
        if (!result) {
            throw new Error('Failed to update analytics preferences');
        }
        return result;
    }
    /**
     * Get personalized tips
     */
    async getPersonalizedTips(userId) {
        const userObjectId = new ObjectId(userId);
        // Get user's preferences
        const prefs = await this.getAnalyticsPreferences(userId);
        if (!prefs.dataCollection.personalizedTips) {
            return [];
        }
        // Get active tips
        return this.db
            .getCollection('personalized_tips')
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
    async createSnapshot(userId, type) {
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
            .getCollection('collections')
            .find({ userId: new ObjectId(userId) })
            .toArray();
        const collectionInsights = await Promise.all(collections.map(c => this.getCollectionInsights(userId, c._id.toString())));
        const snapshot = {
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
        const result = await this.db.getCollection('analytics_snapshots').insertOne(snapshot);
        return {
            ...snapshot,
            _id: result.insertedId
        };
    }
    calculatePeriod(type, date) {
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
    calculateAverageDifficulty(recipes) {
        const difficultyMap = { easy: 1, medium: 2, hard: 3 };
        const sum = recipes.reduce((acc, r) => acc + (difficultyMap[r.difficulty] || 0), 0);
        return recipes.length > 0 ? sum / recipes.length : 0;
    }
    calculateCuisineDistribution(recipes) {
        const distribution = {};
        recipes.forEach(r => {
            // Initialize or increment the count for this cuisine
            const cuisine = r.cuisine || 'Other';
            distribution[cuisine] = (distribution[cuisine] || 0) + 1;
        });
        return distribution;
    }
}
//# sourceMappingURL=user-analytics.service.js.map
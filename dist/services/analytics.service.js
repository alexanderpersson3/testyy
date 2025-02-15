import { ObjectId } from 'mongodb';
;
import { DatabaseService } from '../db/database.service.js';
import { ValidationError } from '../types/errors.js';
import { CookingStats, UsageMetrics, AnalyticsPreferences, PersonalizedTip, AnalyticsSnapshot, Achievement, AnalyticsEvent, TrendAnalysis } from '../types/analytics.js';
import { isCookingStats, isUsageMetrics, isAnalyticsPreferences, isPersonalizedTip, isAnalyticsSnapshot, isAchievement, isAnalyticsEvent, isTrendAnalysis } from '../types/guards.js';
import logger from '../utils/logger.js';
export class AnalyticsService {
    constructor() {
        this.db = DatabaseService.getInstance();
    }
    static getInstance() {
        if (!AnalyticsService.instance) {
            AnalyticsService.instance = new AnalyticsService();
        }
        return AnalyticsService.instance;
    }
    /**
     * Get cooking stats for a user
     */
    async getCookingStats(userId) {
        const stats = await this.db
            .getCollection('cooking_stats')
            .findOne({ userId: new ObjectId(userId) });
        if (!stats) {
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
            if (!isCookingStats(newStats)) {
                throw new ValidationError('Invalid cooking stats structure');
            }
            await this.db.getCollection('cooking_stats').insertOne(newStats);
            return newStats;
        }
        if (!isCookingStats(stats)) {
            throw new ValidationError('Invalid cooking stats data from database');
        }
        return stats;
    }
    /**
     * Update cooking stats
     */
    async updateCookingStats(userId, update) {
        const stats = await this.getCookingStats(userId);
        const updatedStats = { ...stats, ...update, updatedAt: new Date() };
        if (!isCookingStats(updatedStats)) {
            throw new ValidationError('Invalid cooking stats update');
        }
        await this.db
            .getCollection('cooking_stats')
            .updateOne({ userId: new ObjectId(userId) }, { $set: updatedStats });
        return updatedStats;
    }
    /**
     * Get collection insights
     */
    async getCollectionInsights(userId, collectionId) {
        const insights = await this.db
            .getCollection('collection_insights')
            .findOne({
            userId: new ObjectId(userId),
            collectionId: new ObjectId(collectionId)
        });
        if (!insights) {
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
            if (!isCollectionInsights(newInsights)) {
                throw new ValidationError('Invalid collection insights structure');
            }
            await this.db.getCollection('collection_insights').insertOne(newInsights);
            return newInsights;
        }
        if (!isCollectionInsights(insights)) {
            throw new ValidationError('Invalid collection insights data from database');
        }
        return insights;
    }
    /**
     * Get usage metrics
     */
    async getUsageMetrics(userId, period) {
        const metrics = await this.db
            .getCollection('usage_metrics')
            .findOne({
            userId: new ObjectId(userId),
            period
        });
        if (!metrics) {
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
            if (!isUsageMetrics(newMetrics)) {
                throw new ValidationError('Invalid usage metrics structure');
            }
            await this.db.getCollection('usage_metrics').insertOne(newMetrics);
            return newMetrics;
        }
        if (!isUsageMetrics(metrics)) {
            throw new ValidationError('Invalid usage metrics data from database');
        }
        return metrics;
    }
    /**
     * Track analytics event
     */
    async trackEvent(event) {
        const fullEvent = {
            _id: new ObjectId(),
            ...event,
            createdAt: new Date(),
            updatedAt: new Date()
        };
        if (!isAnalyticsEvent(fullEvent)) {
            throw new ValidationError('Invalid analytics event structure');
        }
        await this.db.getCollection('analytics_events').insertOne(fullEvent);
        logger.info('Analytics event tracked', {
            userId: fullEvent.userId.toString(),
            type: fullEvent.type,
            category: fullEvent.category
        });
    }
    /**
     * Get analytics preferences
     */
    async getAnalyticsPreferences(userId) {
        const prefs = await this.db
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
            if (!isAnalyticsPreferences(defaultPrefs)) {
                throw new ValidationError('Invalid analytics preferences structure');
            }
            await this.db.getCollection('analytics_preferences').insertOne(defaultPrefs);
            return defaultPrefs;
        }
        if (!isAnalyticsPreferences(prefs)) {
            throw new ValidationError('Invalid analytics preferences data from database');
        }
        return prefs;
    }
    /**
     * Update analytics preferences
     */
    async updateAnalyticsPreferences(userId, update) {
        const prefs = await this.getAnalyticsPreferences(userId);
        const updatedPrefs = { ...prefs, ...update, updatedAt: new Date() };
        if (!isAnalyticsPreferences(updatedPrefs)) {
            throw new ValidationError('Invalid analytics preferences update');
        }
        await this.db
            .getCollection('analytics_preferences')
            .updateOne({ userId: new ObjectId(userId) }, { $set: updatedPrefs });
        return updatedPrefs;
    }
    /**
     * Create analytics snapshot
     */
    async createSnapshot(userId, type) {
        const userObjectId = new ObjectId(userId);
        const period = this.calculatePeriod(type);
        const [cookingStats, usageMetrics] = await Promise.all([
            this.getCookingStats(userId),
            this.getUsageMetrics(userId, type === 'daily' ? 'day' : type === 'weekly' ? 'week' : 'month')
        ]);
        const collections = await this.db
            .getCollection('collections')
            .find({ userId: userObjectId })
            .toArray();
        const collectionInsights = await Promise.all(collections.map(c => this.getCollectionInsights(userId, c._id.toString())));
        const snapshot = {
            _id: new ObjectId(),
            userId: userObjectId,
            type,
            period,
            cookingStats,
            collectionInsights,
            usageMetrics,
            createdAt: new Date(),
            updatedAt: new Date()
        };
        if (!isAnalyticsSnapshot(snapshot)) {
            throw new ValidationError('Invalid analytics snapshot structure');
        }
        await this.db.getCollection('analytics_snapshots').insertOne(snapshot);
        return snapshot;
    }
    /**
     * Calculate period for snapshot
     */
    calculatePeriod(type) {
        const now = new Date();
        const start = new Date(now);
        const end = new Date(now);
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
}
//# sourceMappingURL=analytics.service.js.map
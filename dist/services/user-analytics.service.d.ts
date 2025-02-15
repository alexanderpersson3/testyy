import type { CollectionInsights } from '../types/index.js';
import { CookingStats, UsageMetrics, AnalyticsPreferences, AnalyticsSnapshot, PersonalizedTip } from '../types/analytics.js';
import type { WithId } from '../types/index.js';
export declare class UserAnalyticsService {
    private static instance;
    private notificationService;
    private db;
    private constructor();
    static getInstance(): UserAnalyticsService;
    /**
     * Get user's cooking stats
     */
    getCookingStats(userId: string): Promise<CookingStats>;
    /**
     * Update user's cooking stats
     */
    updateCookingStats(userId: string, stats: Partial<CookingStats>): Promise<WithId<CookingStats>>;
    /**
     * Get collection insights
     */
    getCollectionInsights(userId: string, collectionId: string): Promise<CollectionInsights>;
    /**
     * Get usage metrics
     */
    getUsageMetrics(userId: string, period: 'day' | 'week' | 'month'): Promise<UsageMetrics>;
    /**
     * Get analytics preferences
     */
    getAnalyticsPreferences(userId: string): Promise<AnalyticsPreferences>;
    /**
     * Update analytics preferences
     */
    updateAnalyticsPreferences(userId: string, preferences: Partial<AnalyticsPreferences>): Promise<WithId<AnalyticsPreferences>>;
    /**
     * Get personalized tips
     */
    getPersonalizedTips(userId: string): Promise<PersonalizedTip[]>;
    /**
     * Create analytics snapshot
     */
    createSnapshot(userId: string, type: AnalyticsSnapshot['type']): Promise<WithId<AnalyticsSnapshot>>;
    private calculatePeriod;
    private calculateAverageDifficulty;
    private calculateCuisineDistribution;
}

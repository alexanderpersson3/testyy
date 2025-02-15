import type { CollectionInsights } from '../types/index.js';
import { CookingStats, UsageMetrics, AnalyticsPreferences, AnalyticsSnapshot, AnalyticsEvent } from '../types/analytics.js';
export declare class AnalyticsService {
    private static instance;
    private db;
    private constructor();
    static getInstance(): AnalyticsService;
    /**
     * Get cooking stats for a user
     */
    getCookingStats(userId: string): Promise<CookingStats>;
    /**
     * Update cooking stats
     */
    updateCookingStats(userId: string, update: Partial<CookingStats>): Promise<CookingStats>;
    /**
     * Get collection insights
     */
    getCollectionInsights(userId: string, collectionId: string): Promise<CollectionInsights>;
    /**
     * Get usage metrics
     */
    getUsageMetrics(userId: string, period: 'day' | 'week' | 'month'): Promise<UsageMetrics>;
    /**
     * Track analytics event
     */
    trackEvent(event: Omit<AnalyticsEvent, '_id' | 'createdAt' | 'updatedAt'>): Promise<void>;
    /**
     * Get analytics preferences
     */
    getAnalyticsPreferences(userId: string): Promise<AnalyticsPreferences>;
    /**
     * Update analytics preferences
     */
    updateAnalyticsPreferences(userId: string, update: Partial<AnalyticsPreferences>): Promise<AnalyticsPreferences>;
    /**
     * Create analytics snapshot
     */
    createSnapshot(userId: string, type: 'daily' | 'weekly' | 'monthly'): Promise<AnalyticsSnapshot>;
    /**
     * Calculate period for snapshot
     */
    private calculatePeriod;
}

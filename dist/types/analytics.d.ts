import { ObjectId } from 'mongodb';
import type { BaseDocument } from '../types/index.js';
/**
 * Interface for cooking statistics
 */
export interface CookingStats extends BaseDocument {
    userId: ObjectId;
    totalRecipesCooked: number;
    totalCookingTime: number;
    favoriteRecipes: Array<{
        recipeId: ObjectId;
        timesCooked: number;
        lastCooked: Date;
        rating: number;
    }>;
    cuisinePreferences: Record<string, number>;
    difficultyDistribution: {
        easy: number;
        medium: number;
        hard: number;
    };
    lastUpdated: Date;
}
/**
 * Interface for collection insights
 */
export interface CollectionInsights extends BaseDocument {
    userId: ObjectId;
    collectionId: ObjectId;
    recipeCount: number;
    totalCookTime: number;
    averageDifficulty: number;
    cuisineDistribution: Record<string, number>;
    lastUpdated: Date;
}
/**
 * Interface for usage metrics
 */
export interface UsageMetrics extends BaseDocument {
    userId: ObjectId;
    period: 'day' | 'week' | 'month';
    recipeViews: number;
    recipeSaves: number;
    recipeShares: number;
    collectionViews: number;
    searchQueries: number;
    filterUsage: Record<string, number>;
    lastUpdated: Date;
}
/**
 * Interface for analytics preferences
 */
export interface AnalyticsPreferences extends BaseDocument {
    userId: ObjectId;
    dataCollection: {
        cookingStats: boolean;
        collectionInsights: boolean;
        usageMetrics: boolean;
        personalizedTips: boolean;
    };
    notifications: {
        weeklyReport: boolean;
        monthlyInsights: boolean;
        achievementAlerts: boolean;
        trendAlerts: boolean;
    };
    privacySettings: {
        shareStats: boolean;
        showInLeaderboards: boolean;
        allowComparison: boolean;
        anonymizeData: boolean;
    };
    reportSettings: {
        format: 'basic' | 'detailed';
        frequency: 'daily' | 'weekly' | 'monthly';
    };
}
/**
 * Interface for personalized tips
 */
export interface PersonalizedTip extends BaseDocument {
    userId: ObjectId;
    type: 'cooking' | 'organization' | 'discovery' | 'health';
    title: string;
    description: string;
    priority: number;
    context: Record<string, any>;
    expiresAt?: Date;
    actionTaken: boolean;
}
/**
 * Interface for analytics snapshots
 */
export interface AnalyticsSnapshot extends BaseDocument {
    userId: ObjectId;
    type: 'daily' | 'weekly' | 'monthly';
    period: {
        start: Date;
        end: Date;
    };
    cookingStats: CookingStats;
    collectionInsights: CollectionInsights[];
    usageMetrics: UsageMetrics;
}
/**
 * Interface for achievement tracking
 */
export interface Achievement extends BaseDocument {
    userId: ObjectId;
    type: string;
    level: number;
    progress: number;
    targetValue: number;
    unlockedAt?: Date;
    metadata: Record<string, any>;
}
/**
 * Interface for analytics event
 */
export interface AnalyticsEvent extends BaseDocument {
    userId: ObjectId;
    type: string;
    category: 'cooking' | 'collection' | 'search' | 'social';
    action: string;
    value?: number;
    metadata: Record<string, any>;
}
/**
 * Interface for trend analysis
 */
export interface TrendAnalysis extends BaseDocument {
    type: 'cuisine' | 'ingredient' | 'cooking_method';
    period: {
        start: Date;
        end: Date;
    };
    trends: Array<{
        name: string;
        growth: number;
        confidence: number;
        dataPoints: number;
    }>;
    metadata: Record<string, any>;
}
export interface ActivityTimelineEntry {
    type: 'cook' | 'favorite' | 'comment' | 'rating';
    timestamp: Date;
    recipeId: ObjectId;
    metadata?: Record<string, any>;
}
export interface PersonalizedInsight {
    type: 'trend' | 'suggestion' | 'achievement';
    title: string;
    description: string;
    data?: Record<string, any>;
}
export interface AnalyticsService {
    getCookingStats(userId: ObjectId): Promise<CookingStats>;
    getActivityTimeline(userId: ObjectId, options: {
        startDate?: Date;
        endDate?: Date;
    }): Promise<ActivityTimelineEntry[]>;
    getUsageMetrics(userId: ObjectId, options: {
        period: string;
    }): Promise<UsageMetrics>;
    getAnalyticsPreferences(userId: ObjectId): Promise<AnalyticsPreferences>;
    updateAnalyticsPreferences(userId: ObjectId, preferences: Partial<AnalyticsPreferences>): Promise<AnalyticsPreferences>;
    getPersonalizedInsights(userId: ObjectId): Promise<PersonalizedInsight[]>;
    getPersonalizedTips(userId: ObjectId): Promise<PersonalizedTip[]>;
    getAchievementProgress(userId: ObjectId): Promise<Achievement[]>;
    logSearch(searchData: SearchData): Promise<void>;
    getSearchMetrics(startDate: Date, endDate: Date): Promise<SearchMetrics>;
    getFilterMetrics(startDate: Date, endDate: Date): Promise<FilterMetrics>;
    getTemporalMetrics(startDate: Date, endDate: Date): Promise<TemporalMetrics>;
}
export interface SearchData {
    userId: ObjectId;
    query: string;
    timestamp: Date;
    resultCount: number;
    filters: string[];
    duration: number;
    successful: boolean;
}
export interface SearchMetrics {
    totalSearches: number;
    uniqueUsers: number;
    averageResults: number;
    noResultQueries: string[];
    popularQueries: Array<{
        query: string;
        count: number;
    }>;
    averageDuration: number;
    errorRate: number;
}
export interface FilterMetrics {
    totalFilterUses: number;
    filterUsageByType: Array<{
        type: string;
        count: number;
    }>;
    popularCombinations: Array<{
        filters: string[];
        count: number;
    }>;
    trendingFilters: Array<{
        type: string;
        trend: number;
    }>;
}
export interface TemporalMetrics {
    byHour: Array<{
        hour: number;
        count: number;
    }>;
    byDay: Array<{
        day: string;
        count: number;
    }>;
    byMonth: Array<{
        month: string;
        count: number;
    }>;
}

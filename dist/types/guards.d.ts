import { ObjectId } from 'mongodb';
import type { CollectionInsights } from '../types/index.js';
import { CookingStats, UsageMetrics, AnalyticsPreferences, PersonalizedTip, AnalyticsSnapshot, Achievement, AnalyticsEvent, TrendAnalysis } from '../analytics.js';
/**
 * Type guard for ObjectId
 */
export declare function isObjectId(value: any): value is ObjectId;
/**
 * Type guard for Date
 */
export declare function isDate(value: any): value is Date;
/**
 * Type guard for CookingStats
 */
export declare function isCookingStats(value: any): value is CookingStats;
/**
 * Type guard for CollectionInsights
 */
export declare function isCollectionInsights(value: any): value is CollectionInsights;
/**
 * Type guard for UsageMetrics
 */
export declare function isUsageMetrics(value: any): value is UsageMetrics;
/**
 * Type guard for AnalyticsPreferences
 */
export declare function isAnalyticsPreferences(value: any): value is AnalyticsPreferences;
/**
 * Type guard for PersonalizedTip
 */
export declare function isPersonalizedTip(value: any): value is PersonalizedTip;
/**
 * Type guard for AnalyticsSnapshot
 */
export declare function isAnalyticsSnapshot(value: any): value is AnalyticsSnapshot;
/**
 * Type guard for Achievement
 */
export declare function isAchievement(value: any): value is Achievement;
/**
 * Type guard for AnalyticsEvent
 */
export declare function isAnalyticsEvent(value: any): value is AnalyticsEvent;
/**
 * Type guard for TrendAnalysis
 */
export declare function isTrendAnalysis(value: any): value is TrendAnalysis;

import { ObjectId } from 'mongodb';
;
import { CookingStats, UsageMetrics, AnalyticsPreferences, PersonalizedTip, AnalyticsSnapshot, Achievement, AnalyticsEvent, TrendAnalysis } from '../analytics.js';
/**
 * Type guard for ObjectId
 */
export function isObjectId(value) {
    return value instanceof ObjectId;
}
/**
 * Type guard for Date
 */
export function isDate(value) {
    return value instanceof Date && !isNaN(value.getTime());
}
/**
 * Type guard for CookingStats
 */
export function isCookingStats(value) {
    return (value &&
        typeof value === 'object' &&
        isObjectId(value.userId) &&
        typeof value.totalRecipesCooked === 'number' &&
        typeof value.totalCookingTime === 'number' &&
        Array.isArray(value.favoriteRecipes) &&
        value.favoriteRecipes.every((recipe) => isObjectId(recipe.recipeId) &&
            typeof recipe.timesCooked === 'number' &&
            isDate(recipe.lastCooked) &&
            typeof recipe.rating === 'number') &&
        typeof value.cuisinePreferences === 'object' &&
        typeof value.difficultyDistribution === 'object' &&
        isDate(value.lastUpdated));
}
/**
 * Type guard for CollectionInsights
 */
export function isCollectionInsights(value) {
    return (value &&
        typeof value === 'object' &&
        isObjectId(value.userId) &&
        isObjectId(value.collectionId) &&
        typeof value.recipeCount === 'number' &&
        typeof value.totalCookTime === 'number' &&
        typeof value.averageDifficulty === 'number' &&
        typeof value.cuisineDistribution === 'object' &&
        isDate(value.lastUpdated));
}
/**
 * Type guard for UsageMetrics
 */
export function isUsageMetrics(value) {
    return (value &&
        typeof value === 'object' &&
        isObjectId(value.userId) &&
        ['day', 'week', 'month'].includes(value.period) &&
        typeof value.recipeViews === 'number' &&
        typeof value.recipeSaves === 'number' &&
        typeof value.recipeShares === 'number' &&
        typeof value.collectionViews === 'number' &&
        typeof value.searchQueries === 'number' &&
        typeof value.filterUsage === 'object' &&
        isDate(value.lastUpdated));
}
/**
 * Type guard for AnalyticsPreferences
 */
export function isAnalyticsPreferences(value) {
    return (value &&
        typeof value === 'object' &&
        isObjectId(value.userId) &&
        typeof value.dataCollection === 'object' &&
        typeof value.notifications === 'object' &&
        typeof value.privacySettings === 'object' &&
        typeof value.reportSettings === 'object' &&
        ['basic', 'detailed'].includes(value.reportSettings.format) &&
        ['daily', 'weekly', 'monthly'].includes(value.reportSettings.frequency));
}
/**
 * Type guard for PersonalizedTip
 */
export function isPersonalizedTip(value) {
    return (value &&
        typeof value === 'object' &&
        isObjectId(value.userId) &&
        ['cooking', 'organization', 'discovery', 'health'].includes(value.type) &&
        typeof value.title === 'string' &&
        typeof value.description === 'string' &&
        typeof value.priority === 'number' &&
        typeof value.context === 'object' &&
        (value.expiresAt === undefined || isDate(value.expiresAt)) &&
        typeof value.actionTaken === 'boolean');
}
/**
 * Type guard for AnalyticsSnapshot
 */
export function isAnalyticsSnapshot(value) {
    return (value &&
        typeof value === 'object' &&
        isObjectId(value.userId) &&
        ['daily', 'weekly', 'monthly'].includes(value.type) &&
        typeof value.period === 'object' &&
        isDate(value.period.start) &&
        isDate(value.period.end) &&
        isCookingStats(value.cookingStats) &&
        Array.isArray(value.collectionInsights) &&
        value.collectionInsights.every(isCollectionInsights) &&
        isUsageMetrics(value.usageMetrics));
}
/**
 * Type guard for Achievement
 */
export function isAchievement(value) {
    return (value &&
        typeof value === 'object' &&
        isObjectId(value.userId) &&
        typeof value.type === 'string' &&
        typeof value.level === 'number' &&
        typeof value.progress === 'number' &&
        typeof value.targetValue === 'number' &&
        (value.unlockedAt === undefined || isDate(value.unlockedAt)) &&
        typeof value.metadata === 'object');
}
/**
 * Type guard for AnalyticsEvent
 */
export function isAnalyticsEvent(value) {
    return (value &&
        typeof value === 'object' &&
        isObjectId(value.userId) &&
        typeof value.type === 'string' &&
        ['cooking', 'collection', 'search', 'social'].includes(value.category) &&
        typeof value.action === 'string' &&
        (value.value === undefined || typeof value.value === 'number') &&
        typeof value.metadata === 'object');
}
/**
 * Type guard for TrendAnalysis
 */
export function isTrendAnalysis(value) {
    return (value &&
        typeof value === 'object' &&
        ['cuisine', 'ingredient', 'cooking_method'].includes(value.type) &&
        typeof value.period === 'object' &&
        isDate(value.period.start) &&
        isDate(value.period.end) &&
        Array.isArray(value.trends) &&
        value.trends.every((trend) => typeof trend === 'object' &&
            typeof trend.name === 'string' &&
            typeof trend.growth === 'number' &&
            typeof trend.confidence === 'number' &&
            typeof trend.dataPoints === 'number') &&
        typeof value.metadata === 'object');
}
//# sourceMappingURL=guards.js.map
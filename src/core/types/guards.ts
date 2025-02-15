import type { Recipe, CreateRecipeDTO, Difficulty } from './recipe.js';
import type { AIRecipeRequest, AIRecipeResponse } from '../services/ai.service.js';
import type { RecommendationContext, MatchFactors } from '../services/recommendation.service.js';
import { ObjectId } from 'mongodb';
import type { CollectionInsights } from '../types/express.js';
import { CookingStats, UsageMetrics, AnalyticsPreferences, PersonalizedTip, AnalyticsSnapshot, Achievement, AnalyticsEvent, TrendAnalysis } from '../analytics.js';;
/**
 * Type guard for ObjectId
 */
export function isObjectId(value: any): value is ObjectId {
  return value instanceof ObjectId;
}

/**
 * Type guard for Date
 */
export function isDate(value: any): value is Date {
  return value instanceof Date && !isNaN(value.getTime());
}

/**
 * Type guard for CookingStats
 */
export function isCookingStats(value: any): value is CookingStats {
  return (
    value &&
    typeof value === 'object' &&
    isObjectId(value.userId) &&
    typeof value.totalRecipesCooked === 'number' &&
    typeof value.totalCookingTime === 'number' &&
    Array.isArray(value.favoriteRecipes) &&
    value.favoriteRecipes.every((recipe: any) =>
      isObjectId(recipe.recipeId) &&
      typeof recipe.timesCooked === 'number' &&
      isDate(recipe.lastCooked) &&
      typeof recipe.rating === 'number'
    ) &&
    typeof value.cuisinePreferences === 'object' &&
    typeof value.difficultyDistribution === 'object' &&
    isDate(value.lastUpdated)
  );
}

/**
 * Type guard for CollectionInsights
 */
export function isCollectionInsights(value: any): value is CollectionInsights {
  return (
    value &&
    typeof value === 'object' &&
    isObjectId(value.userId) &&
    isObjectId(value.collectionId) &&
    typeof value.recipeCount === 'number' &&
    typeof value.totalCookTime === 'number' &&
    typeof value.averageDifficulty === 'number' &&
    typeof value.cuisineDistribution === 'object' &&
    isDate(value.lastUpdated)
  );
}

/**
 * Type guard for UsageMetrics
 */
export function isUsageMetrics(value: any): value is UsageMetrics {
  return (
    value &&
    typeof value === 'object' &&
    isObjectId(value.userId) &&
    ['day', 'week', 'month'].includes(value.period) &&
    typeof value.recipeViews === 'number' &&
    typeof value.recipeSaves === 'number' &&
    typeof value.recipeShares === 'number' &&
    typeof value.collectionViews === 'number' &&
    typeof value.searchQueries === 'number' &&
    typeof value.filterUsage === 'object' &&
    isDate(value.lastUpdated)
  );
}

/**
 * Type guard for AnalyticsPreferences
 */
export function isAnalyticsPreferences(value: any): value is AnalyticsPreferences {
  return (
    value &&
    typeof value === 'object' &&
    isObjectId(value.userId) &&
    typeof value.dataCollection === 'object' &&
    typeof value.notifications === 'object' &&
    typeof value.privacySettings === 'object' &&
    typeof value.reportSettings === 'object' &&
    ['basic', 'detailed'].includes(value.reportSettings.format) &&
    ['daily', 'weekly', 'monthly'].includes(value.reportSettings.frequency)
  );
}

/**
 * Type guard for PersonalizedTip
 */
export function isPersonalizedTip(value: any): value is PersonalizedTip {
  return (
    value &&
    typeof value === 'object' &&
    isObjectId(value.userId) &&
    ['cooking', 'organization', 'discovery', 'health'].includes(value.type) &&
    typeof value.title === 'string' &&
    typeof value.description === 'string' &&
    typeof value.priority === 'number' &&
    typeof value.context === 'object' &&
    (value.expiresAt === undefined || isDate(value.expiresAt)) &&
    typeof value.actionTaken === 'boolean'
  );
}

/**
 * Type guard for AnalyticsSnapshot
 */
export function isAnalyticsSnapshot(value: any): value is AnalyticsSnapshot {
  return (
    value &&
    typeof value === 'object' &&
    isObjectId(value.userId) &&
    ['daily', 'weekly', 'monthly'].includes(value.type) &&
    typeof value.period === 'object' &&
    isDate(value.period.start) &&
    isDate(value.period.end) &&
    isCookingStats(value.cookingStats) &&
    Array.isArray(value.collectionInsights) &&
    value.collectionInsights.every(isCollectionInsights) &&
    isUsageMetrics(value.usageMetrics)
  );
}

/**
 * Type guard for Achievement
 */
export function isAchievement(value: any): value is Achievement {
  return (
    value &&
    typeof value === 'object' &&
    isObjectId(value.userId) &&
    typeof value.type === 'string' &&
    typeof value.level === 'number' &&
    typeof value.progress === 'number' &&
    typeof value.targetValue === 'number' &&
    (value.unlockedAt === undefined || isDate(value.unlockedAt)) &&
    typeof value.metadata === 'object'
  );
}

/**
 * Type guard for AnalyticsEvent
 */
export function isAnalyticsEvent(value: any): value is AnalyticsEvent {
  return (
    value &&
    typeof value === 'object' &&
    isObjectId(value.userId) &&
    typeof value.type === 'string' &&
    ['cooking', 'collection', 'search', 'social'].includes(value.category) &&
    typeof value.action === 'string' &&
    (value.value === undefined || typeof value.value === 'number') &&
    typeof value.metadata === 'object'
  );
}

/**
 * Type guard for TrendAnalysis
 */
export function isTrendAnalysis(value: any): value is TrendAnalysis {
  return (
    value &&
    typeof value === 'object' &&
    ['cuisine', 'ingredient', 'cooking_method'].includes(value.type) &&
    typeof value.period === 'object' &&
    isDate(value.period.start) &&
    isDate(value.period.end) &&
    Array.isArray(value.trends) &&
    value.trends.every((trend: any) =>
      typeof trend === 'object' &&
      typeof trend.name === 'string' &&
      typeof trend.growth === 'number' &&
      typeof trend.confidence === 'number' &&
      typeof trend.dataPoints === 'number'
    ) &&
    typeof value.metadata === 'object'
  );
}

/**
 * Type guard for Recipe objects
 */
export function isRecipe(value: unknown): value is Recipe {
  if (!value || typeof value !== 'object') return false;
  
  const recipe = value as Recipe;
  return (
    recipe._id instanceof ObjectId &&
    typeof recipe.title === 'string' &&
    typeof recipe.description === 'string' &&
    Array.isArray(recipe.ingredients) &&
    Array.isArray(recipe.instructions) &&
    typeof recipe.servings === 'number' &&
    typeof recipe.prepTime === 'number' &&
    typeof recipe.cookTime === 'number' &&
    isDifficulty(recipe.difficulty) &&
    Array.isArray(recipe.tags) &&
    Array.isArray(recipe.images) &&
    recipe.createdAt instanceof Date &&
    recipe.updatedAt instanceof Date
  );
}

/**
 * Type guard for Difficulty enum
 */
export function isDifficulty(value: unknown): value is Difficulty {
  return typeof value === 'string' && ['easy', 'medium', 'hard'].includes(value);
}

/**
 * Type guard for AIRecipeRequest objects
 */
export function isAIRecipeRequest(value: unknown): value is AIRecipeRequest {
  if (!value || typeof value !== 'object') return false;
  
  const request = value as AIRecipeRequest;
  return (
    Array.isArray(request.ingredients) &&
    request.ingredients.every((i: unknown) => typeof i === 'string') &&
    (!request.preferences || (
      typeof request.preferences === 'object' &&
      (!request.preferences.cuisine || typeof request.preferences.cuisine === 'string') &&
      (!request.preferences.dietary || (Array.isArray(request.preferences.dietary) && request.preferences.dietary.every((d: unknown) => typeof d === 'string'))) &&
      (!request.preferences.difficulty || isDifficulty(request.preferences.difficulty)) &&
      (!request.preferences.maxTime || typeof request.preferences.maxTime === 'number')
    ))
  );
}

/**
 * Type guard for RecommendationContext objects
 */
export function isRecommendationContext(value: unknown): value is RecommendationContext {
  if (!value || typeof value !== 'object') return false;
  
  const context = value as RecommendationContext;
  return (
    (!context.userId || context.userId instanceof ObjectId) &&
    (!context.preferences || (
      typeof context.preferences === 'object' &&
      (!context.preferences.cuisines || (Array.isArray(context.preferences.cuisines) && context.preferences.cuisines.every((c: unknown) => typeof c === 'string'))) &&
      (!context.preferences.dietary || (Array.isArray(context.preferences.dietary) && context.preferences.dietary.every((d: unknown) => typeof d === 'string'))) &&
      (!context.preferences.difficulty || (Array.isArray(context.preferences.difficulty) && context.preferences.difficulty.every((d: unknown) => isDifficulty(d)))) &&
      (!context.preferences.maxTime || typeof context.preferences.maxTime === 'number')
    )) &&
    (!context.history || (
      typeof context.history === 'object' &&
      (!context.history.viewedRecipes || (Array.isArray(context.history.viewedRecipes) && context.history.viewedRecipes.every(id => id instanceof ObjectId))) &&
      (!context.history.likedRecipes || (Array.isArray(context.history.likedRecipes) && context.history.likedRecipes.every(id => id instanceof ObjectId))) &&
      (!context.history.cookedRecipes || (Array.isArray(context.history.cookedRecipes) && context.history.cookedRecipes.every(id => id instanceof ObjectId)))
    )) &&
    (!context.season || typeof context.season === 'string') &&
    (!context.mealType || typeof context.mealType === 'string') &&
    (!context.time || context.time instanceof Date)
  );
}

/**
 * Type guard for MatchFactors objects
 */
export function isMatchFactors(value: unknown): value is MatchFactors {
  if (!value || typeof value !== 'object') return false;
  
  const factors = value as MatchFactors;
  return (
    typeof factors.preferences === 'number' &&
    typeof factors.history === 'number' &&
    typeof factors.popularity === 'number' &&
    typeof factors.seasonality === 'number' &&
    typeof factors.difficulty === 'number' &&
    typeof factors.timing === 'number' &&
    factors.preferences >= 0 && factors.preferences <= 1 &&
    factors.history >= 0 && factors.history <= 1 &&
    factors.popularity >= 0 && factors.popularity <= 1 &&
    factors.seasonality >= 0 && factors.seasonality <= 1 &&
    factors.difficulty >= 0 && factors.difficulty <= 1 &&
    factors.timing >= 0 && factors.timing <= 1
  );
}

/**
 * Validates a recipe object and returns validation errors
 */
export function validateRecipe(recipe: unknown): string[] {
  const errors: string[] = [];
  
  if (!recipe || typeof recipe !== 'object') {
    return ['Invalid recipe object'];
  }

  const r = recipe as Partial<Recipe>;

  if (!r.title?.trim()) {
    errors.push('Title is required');
  }

  if (!r.description?.trim()) {
    errors.push('Description is required');
  }

  if (!Array.isArray(r.ingredients) || r.ingredients.length === 0) {
    errors.push('At least one ingredient is required');
  } else {
    r.ingredients.forEach((ing, i) => {
      if (!ing.name?.trim()) {
        errors.push(`Ingredient ${i + 1} name is required`);
      }
      if (typeof ing.amount !== 'number' || ing.amount <= 0) {
        errors.push(`Ingredient ${i + 1} amount must be a positive number`);
      }
      if (!ing.unit?.trim()) {
        errors.push(`Ingredient ${i + 1} unit is required`);
      }
    });
  }

  if (!Array.isArray(r.instructions) || r.instructions.length === 0) {
    errors.push('At least one instruction is required');
  } else {
    r.instructions.forEach((inst, i) => {
      if (!inst.text?.trim()) {
        errors.push(`Instruction ${i + 1} text is required`);
      }
      if (typeof inst.step !== 'number' || inst.step <= 0) {
        errors.push(`Instruction ${i + 1} step must be a positive number`);
      }
    });
  }

  if (typeof r.servings !== 'number' || r.servings <= 0) {
    errors.push('Servings must be a positive number');
  }

  if (typeof r.prepTime !== 'number' || r.prepTime < 0) {
    errors.push('Preparation time must be a non-negative number');
  }

  if (typeof r.cookTime !== 'number' || r.cookTime < 0) {
    errors.push('Cooking time must be a non-negative number');
  }

  if (!isDifficulty(r.difficulty)) {
    errors.push('Invalid difficulty level');
  }

  if (!Array.isArray(r.tags)) {
    errors.push('Tags must be an array');
  }

  if (!Array.isArray(r.images)) {
    errors.push('Images must be an array');
  }

  return errors;
} 
import type { Recipe } from '../types/express.js';
import { ObjectId } from 'mongodb';
import type { Request as ExpressRequest, Response as ExpressResponse, NextFunction as ExpressNextFunction } from 'express';
import type { ParamsDictionary } from 'express-serve-static-core';
import type { ParsedQs } from 'qs';

// Re-export common types
export * from './base.js';
export * from './errors.js';
export * from './mongodb.js';
export * from './recipe.js';
export * from './validation.js';
export * from './middleware.js';

// Base document types
export interface BaseDocument {
  _id: ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

// MongoDB specific types
export interface MongoDocument extends BaseDocument {
  _id: ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export type Filter<T> = {
  [P in keyof T]?: T[P] | { 
    $in?: T[P][];
    $nin?: T[P][];
    $exists?: boolean;
    $ne?: T[P];
    $gt?: T[P];
    $gte?: T[P];
    $lt?: T[P];
    $lte?: T[P];
    $regex?: string;
    $options?: string;
  };
};

// Express types with better type safety
export type Request<
  P = ParamsDictionary,
  ResBody = any,
  ReqBody = any,
  ReqQuery = ParsedQs,
> = Omit<ExpressRequest<P, ResBody, ReqBody, ReqQuery>, 'body'> & {
  body: ReqBody;
};

export type Response<ResBody = any> = ExpressResponse<ResBody>;
export type NextFunction = ExpressNextFunction;

// Analytics types
export interface CollectionInsights {
  userId: ObjectId;
  collectionId: ObjectId;
  recipeCount: number;
  totalCookTime: number;
  averageDifficulty: number;
  cuisineDistribution: Record<string, number>;
  lastUpdated: Date;
}

export interface CookingStats {
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
  difficultyDistribution: Record<string, number>;
  lastUpdated: Date;
}

export interface UsageMetrics {
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

export interface AnalyticsPreferences {
  userId: ObjectId;
  dataCollection: {
    enabled: boolean;
    anonymized: boolean;
    categories: string[];
  };
  notifications: {
    enabled: boolean;
    frequency: 'daily' | 'weekly' | 'monthly';
    types: string[];
  };
  privacySettings: {
    shareUsageData: boolean;
    shareCookingStats: boolean;
    publicProfile: boolean;
  };
  reportSettings: {
    format: 'basic' | 'detailed';
    frequency: 'daily' | 'weekly' | 'monthly';
    categories: string[];
  };
}

export interface PersonalizedTip {
  userId: ObjectId;
  type: 'cooking' | 'organization' | 'discovery' | 'health';
  title: string;
  description: string;
  priority: number;
  context: Record<string, unknown>;
  expiresAt?: Date;
  actionTaken: boolean;
}

export interface AnalyticsSnapshot {
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

export interface Achievement {
  userId: ObjectId;
  type: string;
  level: number;
  progress: number;
  targetValue: number;
  unlockedAt?: Date;
  metadata: Record<string, unknown>;
}

export interface AnalyticsEvent {
  userId: ObjectId;
  type: string;
  category: 'cooking' | 'collection' | 'search' | 'social';
  action: string;
  value?: number;
  metadata: Record<string, unknown>;
}

export interface TrendAnalysis {
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
  metadata: Record<string, unknown>;
}

// Type guards
export function isObjectId(value: unknown): value is ObjectId {
  return value instanceof ObjectId;
}

export function isMongoDocument(value: unknown): value is MongoDocument {
  return (
    typeof value === 'object' &&
    value !== null &&
    '_id' in value &&
    isObjectId((value as any)._id) &&
    'createdAt' in value &&
    'updatedAt' in value
  );
}

export function isBaseDocument(value: unknown): value is BaseDocument {
  return isMongoDocument(value);
}

// Utility types
export type WithId<T> = T & { _id: ObjectId };
export type WithOptionalId<T> = T & { _id?: ObjectId };
export type CreateDocument<T> = Omit<T, '_id' | 'createdAt' | 'updatedAt'>;
export type UpdateDocument<T> = Partial<Omit<T, '_id' | 'createdAt' | 'updatedAt'>>;

export enum NotificationChannel {
  IN_APP = 'in_app',
  EMAIL = 'email',
  PUSH = 'push',
  SMS = 'sms',
}

export type NotificationType =
  | 'recipe_comment'
  | 'recipe_like'
  | 'recipe_share'
  | 'collection_share'
  | 'cooking_session_invite'
  | 'cooking_session_update'
  | 'new_follower'
  | 'follow_request'
  | 'follow_accepted'
  | 'new_story'
  | 'story_update'
  | 'story_like'
  | 'story_comment'
  | 'performance_alert'
  | 'security_alert'
  | 'system_update'
  | 'security_update'
  | 'export_completed'
  | 'export_failed'
  | 'import_completed'
  | 'import_failed'
  | 'new_device';

export type NotificationStatus = 'pending' | 'delivered' | 'sent' | 'failed' | 'read';

export interface Notification {
  _id?: ObjectId;
  userId: ObjectId;
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, unknown>;
  read: boolean;
  createdAt: Date;
  updatedAt?: Date;
  channels: NotificationChannel[];
  status: {
    in_app?: NotificationStatus;
    email?: NotificationStatus;
    push?: NotificationStatus;
  };
}

export interface NotificationPreferences {
  _id?: ObjectId;
  userId: ObjectId;
  channels: {
    [key in NotificationType]: NotificationChannel[];
  };
  schedule: {
    digest: boolean;
    digestFrequency: 'daily' | 'weekly';
    digestTime: string; // HH:mm format
    quietHours: {
      enabled: boolean;
      start: string; // HH:mm format
      end: string; // HH:mm format
      timezone: string;
    };
  };
  createdAt: Date;
  updatedAt: Date;
}

// Base types - core functionality
export type * from '../auth.js';
export type * from '../scaling.js';
export type * from '../health.js';
export type * from '../import-export.js';
export type * from '../error.types.js';
export type * from '../cache.types.js';
export type * from '../sync.js';
export type * from '../language.js';

// Recipe types
export type {
  Recipe,
  RecipeInstruction,
  RecipeComment,
  RecipeRating,
  MealPlan as UserMealPlan,
  Ingredient as RecipeIngredient,
  NutritionalInfo as RecipeNutritionalInfo,
  RecipeCollection
} from '../recipe.js';

// Store types
export type {
  Store as IngredientStore
} from '../store.js';

// User types
export type {
  UserSettings as UserProfileSettings,
  UserPreferences,
  UserStats
} from '../user.js';

// Social types
export type {
  Activity,
  FollowSuggestion,
  UserFollowing,
  UserProfile,
  Comment,
  Follow
} from '../social.js';

import type { Recipe } from '../types/express.js';
import { ObjectId } from 'mongodb';;;;
import type { MongoDocument } from '../types/express.js';
export interface RecipeSimilarity extends MongoDocument {
  recipe1Id: ObjectId;
  recipe2Id: ObjectId;
  score: number;
  factors: {
    ingredients: number;
    cuisine: number;
    tags: number;
    difficulty: number;
  };
}

export interface ViewRecord extends MongoDocument {
  recipeId: ObjectId;
  viewedAt: Date;
}

export interface ActionRecord extends MongoDocument {
  recipeId: ObjectId;
}

export interface UserBehavior {
  views: Array<ViewRecord>;
  likes: Array<ActionRecord>;
  saves: Array<ActionRecord>;
}

export interface UserPreferences {
  cuisines: string[];
  ingredients: string[];
  difficulty: 'easy' | 'medium' | 'hard';
  maxTime: number;
  dietaryRestrictions: string[];
}

export interface RecommendationScore extends MongoDocument {
  recipeId: ObjectId;
  type: RecommendationType;
  score: number;
  lastUpdated: Date;
}

export type RecommendationType =
  | 'similar' // Similar to recipes user liked
  | 'trending' // Popular recipes
  | 'personalized' // Based on user preferences
  | 'seasonal' // Based on current season
  | 'collaborative' // Based on similar users
  | 'dietary' // Based on dietary preferences
  | 'difficulty' // Based on user skill level
  | 'quick' // Quick recipes
  | 'new'; // Recently added recipes

export interface RecommendationMetrics extends MongoDocument {
  userId: ObjectId;
  recommendationType: RecommendationType;
  impressions: number;
  clicks: number;
  saves: number;
  conversions: number;
  ctr: number;
  timestamp: Date;
}

export interface RecommendationFeedback extends MongoDocument {
  userId: ObjectId;
  recipeId: ObjectId;
  recommendationType: RecommendationType;
  action: 'accept' | 'reject' | 'irrelevant';
  reason?: string;
  timestamp: Date;
}

export interface RecommendationConfig {
  weights: {
    userPreferences: number;
    userHistory: number;
    popularity: number;
    seasonality: number;
    difficulty: number;
    timing: number;
  };
  thresholds: {
    minimumScore: number;
    viewThreshold: number;
    saveThreshold: number;
    ratingThreshold: number;
  };
  decay: {
    viewHalfLife: number; // in days
    saveHalfLife: number;
    ratingHalfLife: number;
  };
  limits: {
    maxRecommendations: number;
    cacheExpiry: number; // in minutes
    updateInterval: number; // in minutes
  };
}

export interface RecommendationContext {
  userId: string;
  type: RecommendationType;
  limit?: number;
  offset?: number;
  filters?: {
    cuisine?: string[];
    difficulty?: string[];
    maxTime?: number;
    ingredients?: string[];
    dietary?: string[];
    season?: string;
  };
}

export interface RecommendationResult {
  recipes: {
    _id: ObjectId;
    name: string;
    description?: string;
    imageUrl?: string;
    difficulty: string;
    prepTime: number;
    cookTime: number;
    rating: number;
    matchScore: number;
    matchFactors: {
      [key: string]: number;
    };
  }[];
  total: number;
  context: {
    type: RecommendationType;
    filters: Record<string, any>;
    timestamp: Date;
  };
}

export interface UserPreference extends MongoDocument {
  userId: ObjectId;
  cuisinePreferences: string[];
  dietaryRestrictions: string[];
  allergies: string[];
  favoriteIngredients: string[];
  dislikedIngredients: string[];
  preferredDifficulty: string;
  maxPrepTime?: number;
  maxCookTime?: number;
  servingSize?: number;
}

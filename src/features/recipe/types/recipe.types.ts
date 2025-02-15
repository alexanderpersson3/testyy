import { ObjectId } from 'mongodb';
import type { MongoDocument } from '../../../core/database/types/mongodb.types.js';

export interface Recipe extends MongoDocument {
  title: string;
  description: string;
  ingredients: Ingredient[];
  instructions: string[];
  prepTime: number;
  cookTime: number;
  servings: number;
  difficulty: Difficulty;
  cuisine: string;
  tags: string[];
  author: {
    _id: ObjectId;
    name: string;
  };
  ratings: {
    average: number;
    count: number;
    total: number;
  };
  stats: {
    viewCount: number;
    favoriteCount: number;
    commentCount: number;
  };
  isPublished: boolean;
  language: string;
}

export interface Ingredient {
  name: string;
  amount: number;
  unit: string;
  notes?: string;
}

export enum Difficulty {
  Easy = 'easy',
  Medium = 'medium',
  Hard = 'hard'
}

export interface RecipeStats {
  total: number;
  byDifficulty: Record<Difficulty, number>;
  byCuisine: Record<string, number>;
  averageRating: number;
  totalViews: number;
}

export interface RecipeSearchParams {
  query?: string;
  cuisine?: string;
  difficulty?: Difficulty;
  tags?: string[];
  authorId?: ObjectId;
  minRating?: number;
  maxPrepTime?: number;
  maxCookTime?: number;
  includeIngredients?: string[];
  excludeIngredients?: string[];
  isPublished?: boolean;
  language?: string;
  sortBy?: string;
  limit?: number;
  offset?: number;
}

export type CreateRecipeDTO = Omit<Recipe, keyof MongoDocument>;
export type UpdateRecipeDTO = Partial<CreateRecipeDTO>;

export interface RecipeLike extends MongoDocument {
  userId: ObjectId;
  recipeId: ObjectId;
}

export interface RecipeReport extends MongoDocument {
  recipeId: ObjectId;
  userId: ObjectId;
  reason: 'inappropriate' | 'copyright' | 'spam' | 'other';
  description: string;
  status: 'pending' | 'resolved' | 'rejected';
}

export interface RecipeMedia extends MongoDocument {
  recipeId: ObjectId;
  type: 'image' | 'video';
  url: string;
  thumbnailUrl?: string;
  order: number;
}

export interface RecipeReview extends MongoDocument {
  recipeId: ObjectId;
  userId: ObjectId;
  rating: number;
  comment: string;
  isVerifiedPurchase: boolean;
  helpfulVotes: number;
  reportCount: number;
}

export type RecipeSearchQuery = RecipeSearchParams & {
  $or?: Array<{
    [key: string]: any;
  }>;
}; 
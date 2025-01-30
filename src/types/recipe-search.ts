import { ObjectId } from 'mongodb';
import { Difficulty, DietType } from './recipe';

export interface RecipeAutoCompleteResponse {
  _id: ObjectId;
  name: string;
  description: string;
  difficulty: Difficulty;
  cookTime: number;
  image?: string;
  rating?: {
    average: number;
    count: number;
  };
}

export interface RecipeSearchFilters {
  query?: string;
  categories?: string[];
  tags?: string[];
  difficulty?: Difficulty[];
  maxCookTime?: number;
  cuisine?: string[];
  dietaryRestrictions?: string[];
  excludeIngredients?: string[];
  priceRange?: {
    min?: number;
    max?: number;
    currency?: string;
  };
  rating?: {
    min?: number;
  };
  isPrivate?: boolean;
  isPro?: boolean;
  userId?: ObjectId;
}

export interface RecipeSearchOptions {
  filters: RecipeSearchFilters;
  sort?: {
    field: 'rating' | 'cookTime' | 'createdAt' | 'likes' | 'shares';
    order: 'asc' | 'desc';
  };
  pagination?: {
    limit: number;
    offset: number;
  };
} 
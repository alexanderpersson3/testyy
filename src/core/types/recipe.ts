import { ObjectId } from 'mongodb';

/**
 * Difficulty levels for recipes
 */
export type Difficulty = 'easy' | 'medium' | 'hard';

/**
 * Base recipe interface representing a recipe document in MongoDB
 */
export interface Recipe {
  _id: ObjectId;
  title: string;
  description: string;
  ingredients: Array<{
    name: string;
    amount: number;
    unit: string;
    notes?: string;
    productId?: string;
  }>;
  instructions: Array<{
    step: number;
    text: string;
    image?: string;
    timer?: {
      duration: number;
      unit: 'minutes' | 'hours';
    };
  }>;
  servings: number;
  prepTime: number;
  cookTime: number;
  totalTime?: number;
  difficulty: Difficulty;
  cuisine?: string;
  tags: string[];
  images: string[];
  author?: {
    _id: ObjectId;
    name: string;
  };
  ratings?: {
    average: number;
    count: number;
    total: number;
  };
  stats?: {
    viewCount: number;
    saveCount: number;
    likes: number;
    shares: number;
    comments: number;
  };
  nutritionalInfo?: {
    calories: number;
    protein: number;
    carbohydrates: number;
    fat: number;
    fiber: number;
    sugar?: number;
    sodium?: number;
  };
  dietaryInfo?: {
    vegetarian: boolean;
    vegan: boolean;
    glutenFree: boolean;
    dairyFree: boolean;
    nutFree: boolean;
  };
  seasons?: string[];
  language?: string;
  availableLanguages?: string[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * DTO for creating a new recipe
 */
export type CreateRecipeDTO = Omit<Recipe, '_id' | 'createdAt' | 'updatedAt'>;

/**
 * DTO for updating an existing recipe
 */
export type UpdateRecipeDTO = Partial<Omit<Recipe, '_id' | 'createdAt' | 'updatedAt'>>;

/**
 * Valid sort fields for recipe search
 */
export type RecipeSortField = 'totalTime' | 'rating' | 'newest';

/**
 * Recipe search query parameters
 */
export interface RecipeSearchQuery {
  text?: string;
  cuisine?: string;
  difficulty?: Difficulty;
  tags?: string[];
  limit?: number;
  offset?: number;
  sortBy?: RecipeSortField;
}

/**
 * Recipe like document
 */
export interface RecipeLike {
  _id: ObjectId;
  recipeId: ObjectId;
  userId: ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Report reason type
 */
export type ReportReason = 'inappropriate' | 'copyright' | 'spam' | 'other';

/**
 * Recipe report document
 */
export interface RecipeReport {
  _id: ObjectId;
  recipeId: ObjectId;
  userId: ObjectId;
  reason: ReportReason;
  description?: string;
  status: 'pending' | 'reviewed' | 'resolved';
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Recipe media document
 */
export interface RecipeMedia {
  _id: ObjectId;
  recipeId: ObjectId;
  type: 'image' | 'video';
  url: string;
  thumbnailUrl?: string;
  order: number;
  createdAt: Date;
}

/**
 * Recipe review document
 */
export interface RecipeReview {
  _id: ObjectId;
  recipeId: ObjectId;
  userId: ObjectId;
  rating: number;
  text?: string;
  images?: string[];
  helpful: number;
  reported: boolean;
  createdAt: Date;
  updatedAt: Date;
}

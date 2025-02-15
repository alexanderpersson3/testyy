import type { Recipe } from '../types/index.js';
import { ObjectId } from 'mongodb';
import type { BaseDocument } from '../types/index.js';
import type { RecipeSearchFilters, RecipeSearchOptions } from '../types/index.js';
import type { LanguageCode } from '../types/index.js';
import type { TimerUnit, TimerAlertType } from '../types/index.js';
export type Difficulty = 'easy' | 'medium' | 'hard';
export type DietType = 'any' | 'vegetarian' | 'vegan' | 'glutenFree' | 'dairyFree' | 'keto' | 'paleo';
export type PriceRange = 'budget' | 'moderate' | 'expensive';
export type MediaType = 'image' | 'video';
export type RecipeStatus = 'draft' | 'pending' | 'approved' | 'rejected';
export interface TimerConfig {
    duration: number;
    unit: TimerUnit;
    alerts?: Array<{
        type: TimerAlertType;
        time: number;
        message: string;
    }>;
}
export interface RecipeIngredient {
    name: string;
    amount: number;
    unit: string;
    notes?: string | undefined;
    ingredientId?: ObjectId | undefined;
    estimatedCost?: {
        amount: number;
        currency: string;
        lastUpdated: Date;
    } | undefined;
}
export interface RecipeInstruction {
    step: number;
    text: string;
    duration?: number | undefined;
    temperature?: {
        value: number;
        unit: 'C' | 'F';
    } | undefined;
    timer?: TimerConfig | undefined;
    parallelTimer?: TimerConfig | undefined;
    image?: string | undefined;
}
export interface BaseRecipe {
    title: string;
    description: string;
    ingredients: RecipeIngredient[];
    instructions: RecipeInstruction[];
    servings: number;
    prepTime: number;
    cookTime: number;
    totalTime?: number;
    difficulty: Difficulty;
    cuisine?: string;
    categories?: string[];
    tags: string[];
    images: string[];
    image?: string;
    video?: string;
    author?: {
        _id: ObjectId;
        name: string;
    };
    ratings?: {
        average: number;
        count: number;
    };
    language?: LanguageCode;
    availableLanguages?: LanguageCode[];
    nutritionalInfo?: {
        calories: number;
        protein: number;
        carbohydrates: number;
        fat: number;
        fiber: number;
        sugar?: number;
        sodium?: number;
    };
    mealType?: string;
    visibility?: 'public' | 'private' | 'followers';
    userId?: ObjectId;
    likes?: number;
    stats?: {
        viewCount?: number;
        saveCount?: number;
        rating?: number;
        likes?: number;
        shares?: number;
        comments?: number;
    };
    remixedFrom?: {
        recipeId: ObjectId;
        userId: ObjectId;
    };
}
export interface Recipe extends BaseRecipe, BaseDocument {
}
export type RecipeInput = Omit<BaseRecipe, 'userId' | 'likes' | 'ratings' | 'stats' | 'remixedFrom'>;
export type RecipeUpdate = Partial<RecipeInput> & {
    updatedAt?: Date;
    stats?: {
        viewCount?: number;
        saveCount?: number;
        rating?: number;
        likes?: number;
    };
};
export interface RecipeLike extends BaseDocument {
    userId: ObjectId;
    recipeId: ObjectId;
}
export interface RecipeReport extends BaseDocument {
    recipeId: ObjectId;
    userId: ObjectId;
    reason?: 'inappropriate' | 'copyright' | 'spam' | 'other';
    description?: string;
    status: 'pending' | 'reviewed' | 'resolved';
}
export interface RecipeMedia extends BaseDocument {
    recipeId: ObjectId;
    userId: ObjectId;
    mediaUrl: string;
    mediaType: MediaType;
    isPrimary: boolean;
}
export interface RecipeReview extends BaseDocument {
    recipeId: ObjectId;
    userId: ObjectId;
    rating: number;
    comment?: string;
    media?: {
        mediaUrl: string;
        mediaType: MediaType;
    }[];
    likes: number;
}
export interface RecipeSearchQuery {
    text?: string;
    cuisine?: string;
    difficulty?: Difficulty | Difficulty[];
    tags?: string[];
    maxPrepTime?: number;
    minRating?: number;
    sortBy?: 'rating' | 'newest' | 'totalTime';
    limit?: number;
    offset?: number;
}
export interface UserActivity extends BaseDocument {
    userId: ObjectId;
    type: string;
    originalRecipeId: ObjectId;
    newRecipeId: ObjectId;
}
export interface RecipeDocument extends Recipe {
}
export type { RecipeSearchFilters, RecipeSearchOptions };

import { ObjectId } from 'mongodb';
import type { RecipeDocument, RecipeInput, RecipeUpdate, RecipeSearchQuery, RecipeLike } from '../types/index.js';
export interface RecipeServiceInterface {
    createRecipe(input: RecipeInput): Promise<RecipeDocument>;
    getRecipe(recipeId: ObjectId): Promise<RecipeDocument>;
    getRecipes(recipeIds: ObjectId[]): Promise<RecipeDocument[]>;
    updateRecipe(recipeId: ObjectId, update: RecipeUpdate): Promise<RecipeDocument>;
    deleteRecipe(recipeId: ObjectId): Promise<boolean>;
    searchRecipes(query: RecipeSearchQuery): Promise<RecipeDocument[]>;
    updateRating(recipeId: ObjectId, rating: number): Promise<void>;
    getRecipesByAuthor(authorId: ObjectId): Promise<RecipeDocument[]>;
    getRecipesByTags(tags: string[]): Promise<RecipeDocument[]>;
    getPopularRecipes(limit?: number): Promise<RecipeDocument[]>;
    findRecipeByTitle(title: string): Promise<RecipeDocument | null>;
    toggleLike(recipeId: ObjectId, userId: ObjectId): Promise<boolean>;
    getRecipeLikes(recipeId: ObjectId, options?: {
        page?: number;
        limit?: number;
        includeUser?: boolean;
        excludeFields?: string[];
    }): Promise<{
        likes: Array<RecipeLike & {
            user?: {
                _id: ObjectId;
                name: string;
            };
        }>;
        total: number;
    }>;
    reportRecipe(recipeId: ObjectId, userId: ObjectId, report: {
        reason: 'inappropriate' | 'copyright' | 'spam' | 'other';
        description?: string;
    }): Promise<void>;
    remixRecipe(originalRecipeId: ObjectId, userId: ObjectId): Promise<ObjectId>;
}
export declare class RecipeService implements RecipeServiceInterface {
    private static instance;
    private initialized;
    private db;
    private recipesCollection;
    private likesCollection;
    private reportsCollection;
    private wsService;
    private constructor();
    static getInstance(): RecipeService;
    private initialize;
    private ensureInitialized;
    createRecipe(recipe: RecipeInput): Promise<RecipeDocument>;
    getRecipe(recipeId: ObjectId): Promise<RecipeDocument>;
    getRecipes(recipeIds: ObjectId[]): Promise<RecipeDocument[]>;
    updateRecipe(recipeId: ObjectId, update: RecipeUpdate): Promise<RecipeDocument>;
    deleteRecipe(recipeId: ObjectId): Promise<boolean>;
    searchRecipes(query: RecipeSearchQuery): Promise<RecipeDocument[]>;
    updateRating(recipeId: ObjectId, rating: number): Promise<void>;
    getRecipesByAuthor(authorId: ObjectId): Promise<RecipeDocument[]>;
    getRecipesByTags(tags: string[]): Promise<RecipeDocument[]>;
    getPopularRecipes(limit?: number): Promise<RecipeDocument[]>;
    findRecipeByTitle(title: string): Promise<RecipeDocument | null>;
    toggleLike(recipeId: ObjectId, userId: ObjectId): Promise<boolean>;
    getRecipeLikes(recipeId: ObjectId, options?: {
        page?: number;
        limit?: number;
        includeUser?: boolean;
        excludeFields?: string[];
    }): Promise<{
        likes: Array<RecipeLike & {
            user?: {
                _id: ObjectId;
                name: string;
            };
        }>;
        total: number;
    }>;
    reportRecipe(recipeId: ObjectId, userId: ObjectId, report: {
        reason: 'inappropriate' | 'copyright' | 'spam' | 'other';
        description?: string;
    }): Promise<void>;
    remixRecipe(originalRecipeId: ObjectId, userId: ObjectId): Promise<ObjectId>;
}
export declare const recipeService: RecipeService;

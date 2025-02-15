import { ObjectId } from 'mongodb';
import type { Recipe } from '../types/index.js';
interface RecipeStats {
    viewCount: number;
    saveCount: number;
    likeCount: number;
    commentCount: number;
    averageRating: number;
    ratingCount: number;
}
interface RecipeAnalytics extends RecipeStats {
    periodStart: Date;
    periodEnd: Date;
    dailyViews: Array<{
        date: string;
        count: number;
    }>;
    userDemographics?: {
        ageGroups: Record<string, number>;
        countries: Record<string, number>;
        devices: Record<string, number>;
    };
}
interface ModerationQueueItem {
    _id: ObjectId;
    recipeId: ObjectId;
    submittedBy: ObjectId;
    submittedAt: Date;
    status: 'pending' | 'approved' | 'rejected' | 'changes_requested';
    reviewedBy?: ObjectId;
    reviewedAt?: Date;
    notes?: string[];
    changes?: string[];
}
interface TaxonomyItem {
    _id: ObjectId;
    name: string;
    slug: string;
    type: 'cuisine' | 'dietary' | 'occasion' | 'category';
    description?: string;
    parent?: ObjectId;
    count: number;
    createdAt: Date;
    updatedAt: Date;
}
interface RecipeVersion {
    _id: ObjectId;
    recipeId: ObjectId;
    version: number;
    changes: string[];
    data: Partial<Recipe>;
    createdBy: ObjectId;
    createdAt: Date;
}
export declare class CMSService {
    private static instance;
    private db;
    private moderationService?;
    private constructor();
    static getInstance(): CMSService;
    /**
     * Create or update a recipe
     */
    upsertRecipe(recipe: Partial<Recipe> & {
        _id?: ObjectId;
        createdBy?: ObjectId;
    }): Promise<Recipe>;
    /**
     * Get recipe analytics
     */
    getRecipeAnalytics(recipeId: ObjectId, period: 'day' | 'week' | 'month' | 'year'): Promise<RecipeAnalytics>;
    /**
     * Add recipe to moderation queue
     */
    submitForModeration(recipeId: ObjectId, submittedBy: ObjectId): Promise<void>;
    /**
     * Get moderation queue
     */
    getModerationQueue(status?: ModerationQueueItem['status']): Promise<ModerationQueueItem[]>;
    /**
     * Review recipe in moderation queue
     */
    reviewRecipe(queueItemId: ObjectId, reviewedBy: ObjectId, status: 'approved' | 'rejected' | 'changes_requested', notes?: string[]): Promise<void>;
    /**
     * Manage taxonomy
     */
    upsertTaxonomyItem(item: Partial<TaxonomyItem> & {
        _id?: ObjectId;
    }): Promise<TaxonomyItem>;
    /**
     * Get taxonomy items
     */
    getTaxonomyItems(type?: TaxonomyItem['type']): Promise<TaxonomyItem[]>;
    /**
     * Delete taxonomy item
     */
    deleteTaxonomyItem(itemId: ObjectId): Promise<void>;
    /**
     * Create a new version of a recipe
     */
    createRecipeVersion(recipeId: ObjectId, changes: string[], data: Partial<Recipe>, userId: ObjectId): Promise<RecipeVersion>;
    /**
     * Get recipe versions
     */
    getRecipeVersions(recipeId: ObjectId): Promise<RecipeVersion[]>;
    /**
     * Restore recipe to a specific version
     */
    restoreRecipeVersion(recipeId: ObjectId, version: number): Promise<Recipe>;
    /**
     * Detect changes between recipe versions
     */
    private detectRecipeChanges;
}
export {};

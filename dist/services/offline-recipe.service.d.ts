import type { Recipe } from '../types/index.js';
import type { ObjectId } from '../types/index.js';
import type { RecipeDocument } from '../types/index.js';
interface VersionedRecipe extends RecipeDocument {
    version: number;
    lastModified: Date;
}
interface RecipeWithVersion extends RecipeDocument, VersionedRecipe {
}
interface OfflineRecipe extends RecipeWithVersion {
    syncStatus: 'synced' | 'pending' | 'conflict';
    lastSynced: Date;
    serverVersion?: RecipeWithVersion;
    stats: {
        viewCount: number;
        rating: number;
    };
}
export interface OfflineRecipeServiceInterface {
    saveOffline(recipe: RecipeDocument): Promise<void>;
    getOffline(recipeId: ObjectId): Promise<OfflineRecipe | null>;
    updateOffline(recipeId: ObjectId, updates: Partial<Recipe>): Promise<void>;
    deleteOffline(recipeId: ObjectId): Promise<void>;
    getAllOffline(userId: ObjectId): Promise<OfflineRecipe[]>;
    syncOfflineChanges(userId: ObjectId): Promise<void>;
    checkConflicts(userId: ObjectId): Promise<OfflineRecipe[]>;
    resolveConflict(recipeId: ObjectId, resolution: 'local' | 'server'): Promise<void>;
    preCacheRecipes(userId: ObjectId, options?: {
        limit?: number;
        onProgress?: (progress: number) => void;
    }): Promise<void>;
}
export declare class OfflineRecipeService implements OfflineRecipeServiceInterface {
    private static instance;
    private initialized;
    private db;
    private recipesCollection;
    private readonly cacheService;
    private readonly syncService;
    private readonly CACHE_TTL;
    private constructor();
    private initialize;
    private ensureInitialized;
    static getInstance(): OfflineRecipeService;
    private validateRecipe;
    private getCacheKey;
    saveOffline(recipe: RecipeDocument): Promise<void>;
    getOffline(recipeId: ObjectId): Promise<OfflineRecipe | null>;
    updateOffline(recipeId: ObjectId, updates: Partial<Recipe>): Promise<void>;
    deleteOffline(recipeId: ObjectId): Promise<void>;
    getAllOffline(userId: ObjectId): Promise<OfflineRecipe[]>;
    syncOfflineChanges(userId: ObjectId): Promise<void>;
    checkConflicts(userId: ObjectId): Promise<OfflineRecipe[]>;
    resolveConflict(recipeId: ObjectId, resolution: 'local' | 'server'): Promise<void>;
    preCacheRecipes(userId: ObjectId, options?: {
        limit?: number;
        onProgress?: (progress: number) => void;
    }): Promise<void>;
}
export {};

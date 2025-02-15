import type { ObjectId } from '../types/index.js';
import type { RecipeDocument } from '../types/index.js';
export interface OfflineStorageOptions {
    maxItems?: number;
    expirationDays?: number;
}
export interface OfflineItem {
    userId: ObjectId;
    recipeId: ObjectId;
    savedAt: Date;
    expiresAt: Date;
    syncStatus: 'pending' | 'synced' | 'error';
}
export declare class OfflineStorageService {
    private readonly subscriptionManager;
    private readonly options;
    private readonly DEFAULT_MAX_ITEMS;
    private readonly DEFAULT_EXPIRATION_DAYS;
    private readonly db;
    constructor(subscriptionManager: {
        checkSubscriptionStatus(userId: string): Promise<boolean>;
    }, options?: OfflineStorageOptions);
    markRecipeForOffline(userId: string, recipeId: string): Promise<boolean>;
    getOfflineRecipes(userId: string): Promise<RecipeDocument[]>;
    removeOfflineRecipe(userId: string, recipeId: string): Promise<boolean>;
    cleanupExpiredItems(): Promise<number>;
    private verifyOfflineAccess;
    private calculateExpirationDate;
}

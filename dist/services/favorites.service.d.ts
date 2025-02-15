import type { ObjectId } from '../types/index.js';
import type { Recipe } from '../types/index.js';
import { ShoppingListItem } from '../types/shopping-list.js';
interface Favorite {
    _id: ObjectId;
    userId: ObjectId;
    itemId: ObjectId;
    itemType: 'recipe' | 'ingredient';
    customName?: string;
    defaultQuantity?: number;
    defaultUnit?: string;
    notes?: string;
    createdAt: Date;
    updatedAt: Date;
}
type UpdateFavoriteDTO = Partial<Pick<Favorite, 'customName' | 'defaultQuantity' | 'defaultUnit' | 'notes'>>;
export declare class FavoritesService {
    private static instance;
    private db;
    private initialized;
    private favoritesCollection;
    private recipesCollection;
    private shoppingListsCollection;
    private ingredientsCollection;
    private constructor();
    private initialize;
    private ensureInitialized;
    static getInstance(): FavoritesService;
    /**
     * Add item to favorites
     */
    addFavorite(userId: ObjectId, itemId: ObjectId, itemType: 'recipe' | 'ingredient'): Promise<void>;
    /**
     * Remove item from favorites
     */
    removeFavorite(userId: ObjectId, itemId: ObjectId, itemType: 'recipe' | 'ingredient'): Promise<void>;
    /**
     * Get user's favorites
     */
    getFavorites(userId: ObjectId, itemType?: 'recipe' | 'ingredient'): Promise<Favorite[]>;
    /**
     * Get favorite recipes with details
     */
    getFavoriteRecipes(userId: ObjectId, page?: number, limit?: number): Promise<{
        recipes: Recipe[];
        total: number;
    }>;
    /**
     * Check if item is favorited
     */
    isFavorite(userId: ObjectId, itemId: ObjectId, itemType: 'recipe' | 'ingredient'): Promise<boolean>;
    /**
     * Get popular recipes
     */
    getPopularRecipes(limit?: number): Promise<Recipe[]>;
    /**
     * Update favorite item
     */
    updateFavorite(favoriteId: ObjectId, userId: ObjectId, updates: UpdateFavoriteDTO): Promise<boolean>;
    /**
     * Add favorite item to shopping list
     */
    addFavoriteToShoppingList(userId: ObjectId, favoriteId: ObjectId, listId: ObjectId): Promise<ShoppingListItem>;
}
export {};

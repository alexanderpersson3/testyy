import type { Collection } from 'mongodb';
import type { ObjectId } from '../types/index.js';
import type { Recipe } from '../types/index.js';
export interface FavoriteItem {
    _id?: ObjectId;
    userId: ObjectId;
    itemId: ObjectId;
    itemType: 'recipe' | 'ingredient';
    createdAt: Date;
}
export declare class FavoritesService {
    private favoritesCollection;
    private recipesCollection;
    constructor(favoritesCollection: Collection<FavoriteItem>, recipesCollection: Collection<Recipe>);
    addFavorite(userId: ObjectId, itemId: ObjectId, itemType: 'recipe' | 'ingredient'): Promise<void>;
    removeFavorite(userId: ObjectId, itemId: ObjectId, itemType: 'recipe' | 'ingredient'): Promise<void>;
    getFavorites(userId: ObjectId, itemType?: 'recipe' | 'ingredient'): Promise<FavoriteItem[]>;
    getFavoriteRecipes(userId: ObjectId, page?: number, limit?: number): Promise<{
        recipes: Recipe[];
        total: number;
    }>;
    isFavorite(userId: ObjectId, itemId: ObjectId, itemType: 'recipe' | 'ingredient'): Promise<boolean>;
    getPopularRecipes(limit?: number): Promise<Recipe[]>;
}

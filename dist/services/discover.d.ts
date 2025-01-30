import { Collection, ObjectId } from 'mongodb';
import { Recipe, RecipeDocument } from '../types/recipe.js';
export interface DiscoverOptions {
    userId?: ObjectId;
    category?: string;
    cuisine?: string;
    difficulty?: 'easy' | 'medium' | 'hard';
    maxPrepTime?: number;
    isPro?: boolean;
    page?: number;
    limit?: number;
}
export declare class DiscoverService {
    private recipesCollection;
    constructor(recipesCollection: Collection<Recipe>);
    getPopularRecipes(options?: DiscoverOptions): Promise<{
        recipes: RecipeDocument[];
        total: number;
    }>;
    getRecentRecipes(options?: DiscoverOptions): Promise<{
        recipes: RecipeDocument[];
        total: number;
    }>;
    getTrendingRecipes(options?: DiscoverOptions): Promise<{
        recipes: RecipeDocument[];
        total: number;
    }>;
    getRecommendedRecipes(userId: ObjectId, options?: DiscoverOptions): Promise<{
        recipes: RecipeDocument[];
        total: number;
    }>;
    getPopularCategories(): Promise<{
        name: string;
        count: number;
    }[]>;
    getPopularCuisines(): Promise<{
        name: string;
        count: number;
    }[]>;
}
//# sourceMappingURL=discover.d.ts.map
import { ObjectId } from 'mongodb';
export declare class DiscoverService {
    private static instance;
    private constructor();
    static getInstance(): DiscoverService;
    getTrendingRecipes(limit: number): Promise<any>;
    getPopularRecipes(limit: number): Promise<any>;
    getRecentRecipes(limit: number): Promise<any>;
    getRecommendedRecipes(userId: ObjectId, limit: number): Promise<any>;
    getRecipeSuggestions(limit: number): Promise<any>;
    getRecipeCategories(): Promise<any>;
    getRecipesByCategory(categoryId: ObjectId, limit: number): Promise<any>;
}

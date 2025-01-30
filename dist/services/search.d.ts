import { Collection, ObjectId } from 'mongodb';
import { Recipe, RecipeDocument } from '../types/recipe.js';
export interface SearchOptions {
    query?: string;
    sortBy?: string;
    order?: 'asc' | 'desc';
    categories?: string[];
    tags?: string[];
    difficulty?: 'easy' | 'medium' | 'hard';
    cuisine?: string;
    maxPrepTime?: number;
    isPrivate?: boolean;
    isPro?: boolean;
    userId?: ObjectId;
    page?: number;
    limit?: number;
}
export interface SearchSuggestion {
    type: 'recipe' | 'ingredient' | 'category' | 'tag';
    text: string;
    count: number;
}
export declare class SearchService {
    private recipesCollection;
    constructor(recipesCollection: Collection<Recipe>);
    searchRecipes(options: SearchOptions): Promise<{
        recipes: RecipeDocument[];
        total: number;
    }>;
    getSuggestions(query: string): Promise<SearchSuggestion[]>;
    getPopularSearches(): Promise<{
        text: string;
        count: number;
    }[]>;
}
//# sourceMappingURL=search.d.ts.map
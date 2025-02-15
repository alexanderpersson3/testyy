import type { ObjectId } from '../types/index.js';
import type { RecipeDocument } from '../types/index.js';
import { SearchQuery as BaseSearchQuery, SearchResults } from '../types/search.js';
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
interface SearchQuery extends BaseSearchQuery {
    searchTerm?: string;
}
export declare class SearchService {
    private static instance;
    private readonly DEFAULT_PAGE_SIZE;
    private readonly MAX_PAGE_SIZE;
    private db;
    private client;
    private constructor();
    static getInstance(): SearchService;
    searchRecipes(options: SearchOptions): Promise<{
        recipes: RecipeDocument[];
        total: number;
    }>;
    getSuggestions(query: string): Promise<SearchSuggestion[]>;
    getPopularSearches(): Promise<Array<{
        text: string;
        count: number;
    }>>;
    search(query: SearchQuery): Promise<SearchResults>;
    private buildFilters;
    private buildSort;
    private buildAggregations;
    private processMatch;
}
export {};

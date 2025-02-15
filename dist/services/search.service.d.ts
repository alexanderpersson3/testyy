import { SearchQuery, SearchResults, SearchFacets } from '../types/search.js';
import type { Recipe } from '../types/index.js';
export interface SearchServiceInterface {
    search(query: SearchQuery, userId?: string, sessionId?: string): Promise<SearchResults>;
    getSearchFacets(query: SearchQuery): Promise<SearchFacets>;
}
export interface SearchSuggestion {
    id: string;
    text: string;
    type: 'recipe' | 'ingredient' | 'tag';
    highlights?: Record<string, string[]>;
}
export interface SearchResponse {
    hits: Recipe[];
    total: number;
    page: number;
    totalPages: number;
    aggregations?: {
        cuisines: {
            buckets: Array<{
                key: string;
                doc_count: number;
            }>;
        };
        difficulties: {
            buckets: Array<{
                key: string;
                doc_count: number;
            }>;
        };
        cookingTimes: {
            buckets: Array<{
                key: string;
                doc_count: number;
            }>;
        };
        ratings: {
            buckets: Array<{
                key: number;
                doc_count: number;
            }>;
        };
    };
}
export interface SearchFilters {
    cuisine?: string[];
    difficulty?: string[];
    cookingTime?: {
        min?: number;
        max?: number;
    };
    dietary?: string[];
    ingredients?: string[];
    excludeIngredients?: string[];
    rating?: number;
    sort?: 'trending_daily' | 'trending_weekly' | 'trending_monthly';
}
export declare class SearchService implements SearchServiceInterface {
    private static instance;
    private readonly DEFAULT_PAGE_SIZE;
    private readonly MAX_PAGE_SIZE;
    private initialized;
    private db;
    private recipesCollection;
    private analyticsService;
    private performanceService;
    private client;
    private constructor();
    private initialize;
    private ensureInitialized;
    static getInstance(): SearchService;
    private validateSearchQuery;
    search(query: SearchQuery, userId?: string, sessionId?: string): Promise<SearchResults>;
    private buildSearchQuery;
    private buildSortQuery;
    private processResults;
    /**
     * Generate highlights for text matches
     */
    private generateHighlights;
    /**
     * Get search facets
     */
    getSearchFacets(query: SearchQuery): Promise<SearchFacets>;
    /**
     * Transform facet results
     */
    private transformFacetResults;
    searchElastic(query: string, filters?: SearchFilters, page?: number, limit?: number): Promise<SearchResponse>;
    getSuggestions(query: string): Promise<{
        suggestions: SearchSuggestion[];
    }>;
    private buildFilters;
    private transformResponse;
}

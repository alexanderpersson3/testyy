import type { Recipe } from '../types/index.js';
import { ObjectId } from 'mongodb';
export interface RecipeSearchResponse {
    hits: {
        total: number;
        hits: Array<{
            _id: string;
            _score: number;
            _source: Recipe;
        }>;
    };
}
export interface RecipeSuggestion {
    title: string;
    cuisine?: string;
    difficulty: 'easy' | 'medium' | 'hard';
    score: number;
}
export declare function isRecipeSource(source: any): source is Pick<Recipe, 'title' | 'cuisine' | 'difficulty'>;
/**
 * Search query
 */
export interface SortOption {
    field: string;
    direction: 'asc' | 'desc';
}
export interface SearchQuery {
    text?: string;
    filters?: SearchFilters;
    sort?: SortOption;
    page?: number;
    limit?: number;
}
/**
 * Search filters
 */
export interface SearchFilters {
    category?: string[];
    cuisine?: string[];
    difficulty?: string[];
    time?: {
        min?: number;
        max?: number;
    };
    ingredients?: string[];
}
/**
 * Search result
 */
export interface SearchResult {
    _id: ObjectId;
    title: string;
    description: string;
    score?: number;
    highlights?: {
        title?: string[];
        description?: string[];
        ingredients?: string[];
        instructions?: string[];
    };
}
/**
 * Search results
 */
export interface SearchResults {
    results: SearchResult[];
    total: number;
    page: number;
    totalPages: number;
}
/**
 * Search suggestion
 */
export interface SearchSuggestion {
    text: string;
    score: number;
    type: 'history' | 'popular' | 'trending';
}
/**
 * Search history entry
 */
export interface SearchHistory {
    _id?: ObjectId;
    userId: ObjectId;
    query: string;
    filters?: SearchFilters;
    sort?: SortOption;
    resultCount: number;
    timestamp: Date;
}
/**
 * Popular search
 */
export interface PopularSearch {
    _id?: ObjectId;
    query: string;
    count: number;
    lastSearched: Date;
    period: 'day' | 'week' | 'month' | 'all';
}
/**
 * Search analytics
 */
export interface SearchAnalytics {
    totalSearches: number;
    uniqueUsers: number;
    averageResultCount: number;
    averageExecutionTime: number;
    popularQueries: Array<{
        query: string;
        count: number;
    }>;
    popularFilters: Array<{
        filter: string;
        count: number;
    }>;
    noResultQueries: Array<{
        query: string;
        count: number;
    }>;
}
export interface SearchFacets {
    cuisineTypes: Array<{
        value: string;
        count: number;
    }>;
    mealTypes: Array<{
        value: string;
        count: number;
    }>;
    dietaryRestrictions: Array<{
        value: string;
        count: number;
    }>;
    difficulty: Array<{
        value: string;
        count: number;
    }>;
    tags: Array<{
        value: string;
        count: number;
    }>;
}
/**
 * Search event
 */
export interface SearchEvent {
    _id?: ObjectId;
    userId: ObjectId;
    query: string;
    filters?: SearchFilters;
    resultCount: number;
    executionTimeMs: number;
    sessionId: string;
    successful: boolean;
    timestamp?: Date;
}
/**
 * Search performance metrics
 */
export interface SearchPerformanceMetrics {
    _id?: ObjectId;
    query: string;
    filters?: SearchFilters;
    responseTime: number;
    timestamp: Date;
    userId?: ObjectId;
    successful: boolean;
    resultCount: number;
    cacheHit: boolean;
}

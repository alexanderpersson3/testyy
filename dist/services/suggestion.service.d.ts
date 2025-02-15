export interface QuerySuggestion {
    originalQuery: string;
    suggestedQuery: string;
    confidence: number;
    popularity: number;
}
export declare class SuggestionService {
    private static instance;
    private readonly MIN_CONFIDENCE;
    private readonly MAX_SUGGESTIONS;
    private db;
    private initialized;
    private constructor();
    private initialize;
    private ensureInitialized;
    static getInstance(): SuggestionService;
    /**
     * Get suggestions for a search query
     */
    getSuggestions(query: string): Promise<QuerySuggestion[]>;
    /**
     * Get autocomplete suggestions
     */
    getAutocompleteSuggestions(partialQuery: string, limit?: number): Promise<string[]>;
    /**
     * Get related queries based on user behavior
     */
    getRelatedQueries(query: string): Promise<Array<{
        query: string;
        popularity: number;
    }>>;
    /**
     * Get trending queries
     */
    getTrendingQueries(timeWindow?: number): Promise<Array<{
        query: string;
        searchCount: number;
        growth: number;
    }>>;
}

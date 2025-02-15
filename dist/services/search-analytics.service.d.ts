interface SearchEvent {
    _id?: ObjectId;
    userId?: ObjectId;
    query: string;
    filters?: Record<string, any>;
    resultCount: number;
    executionTimeMs: number;
    timestamp: Date;
    sessionId: string;
}
interface SearchAnalytics {
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
export declare class SearchAnalyticsService {
    private static instance;
    private constructor();
    static getInstance(): SearchAnalyticsService;
    /**
     * Log a search event
     */
    logSearchEvent(event: Omit<SearchEvent, '_id' | 'timestamp'>): Promise<void>;
    /**
     * Get analytics for a time period
     */
    getAnalytics(startDate: Date, endDate: Date): Promise<SearchAnalytics>;
    /**
     * Get search suggestions based on popular queries
     */
    getSearchSuggestions(partialQuery: string, limit?: number): Promise<string[]>;
    /**
     * Get performance metrics
     */
    getPerformanceMetrics(startDate: Date, endDate: Date): Promise<{
        p50: number;
        p90: number;
        p99: number;
    }>;
}
export {};

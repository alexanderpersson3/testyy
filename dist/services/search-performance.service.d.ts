import { ObjectId } from 'mongodb';
interface SearchPerformanceMetrics {
    _id?: ObjectId;
    timestamp: Date;
    averageResponseTime: number;
    p95ResponseTime: number;
    p99ResponseTime: number;
    errorRate: number;
    totalQueries: number;
    uniqueUsers: number;
    cacheHitRate: number;
    slowQueries: Array<{
        query: string;
        responseTime: number;
        timestamp: Date;
    }>;
    errorQueries: Array<{
        query: string;
        error: string;
        timestamp: Date;
    }>;
}
interface QueryPerformance {
    _id?: ObjectId;
    query: string;
    filters?: Record<string, any>;
    responseTime: number;
    timestamp: Date;
    userId?: ObjectId;
    successful: boolean;
    error?: string;
    resultCount: number;
    cacheHit: boolean;
}
export declare class SearchPerformanceService {
    private static instance;
    private notificationService;
    private readonly SLOW_QUERY_THRESHOLD;
    private readonly ERROR_RATE_THRESHOLD;
    private readonly CACHE_HIT_RATE_THRESHOLD;
    private constructor();
    static getInstance(): SearchPerformanceService;
    /**
     * Log query performance
     */
    logQueryPerformance(performance: Omit<QueryPerformance, '_id'>): Promise<void>;
    /**
     * Get performance metrics for a time period
     */
    getPerformanceMetrics(startDate: Date, endDate: Date): Promise<SearchPerformanceMetrics>;
    /**
     * Get real-time performance metrics
     */
    getRealTimeMetrics(minutes?: number): Promise<SearchPerformanceMetrics>;
    /**
     * Handle slow query detection
     */
    private handleSlowQuery;
    /**
     * Update real-time metrics
     */
    private updateRealTimeMetrics;
}
export {};

interface CacheOptions {
    ttl?: number;
    version?: number;
}
export declare class CacheService {
    private static instance;
    private cache;
    private readonly DEFAULT_TTL;
    private readonly MAX_CACHE_SIZE;
    private readonly CLEANUP_INTERVAL;
    private db;
    private constructor();
    static getInstance(): CacheService;
    /**
     * Set a value in the cache
     */
    set<T>(key: string, data: T, options?: CacheOptions): Promise<void>;
    /**
     * Get a value from the cache
     */
    get<T>(key: string): Promise<T | null>;
    /**
     * Delete a value from the cache
     */
    delete(key: string): Promise<void>;
    /**
     * Clear the entire cache
     */
    clear(): Promise<void>;
    /**
     * Get the current cache size
     */
    size(): number;
    /**
     * Check if the cache service is healthy
     */
    isHealthy(): boolean;
    /**
     * Start the cleanup interval
     */
    private startCleanupInterval;
    /**
     * Clean up expired entries
     */
    private cleanup;
    /**
     * Evict the oldest entries when cache is full
     */
    private evictOldest;
    /**
     * Get data progressively with progress tracking
     */
    getProgressively<T>(key: string, fetchData: () => Promise<T>, options?: {
        chunkSize?: number;
        ttl?: number;
        onProgress?: (progress: number) => void;
    }): Promise<T>;
}
export declare const cache: CacheService;
export {};

import { DatabaseService } from '../db/database.service.js';
import logger from '../utils/logger.js';
export class CacheService {
    constructor() {
        this.DEFAULT_TTL = 3600; // 1 hour
        this.MAX_CACHE_SIZE = 1000;
        this.CLEANUP_INTERVAL = 300000; // 5 minutes
        this.cache = new Map();
        this.db = DatabaseService.getInstance();
        this.startCleanupInterval();
    }
    static getInstance() {
        if (!CacheService.instance) {
            CacheService.instance = new CacheService();
        }
        return CacheService.instance;
    }
    /**
     * Set a value in the cache
     */
    async set(key, data, options = {}) {
        const ttl = options.ttl || this.DEFAULT_TTL;
        const version = options.version || 1;
        const entry = {
            data,
            expiresAt: new Date(Date.now() + ttl * 1000),
            lastAccessed: new Date(),
            version,
        };
        this.cache.set(key, entry);
        // Evict oldest entries if cache is too large
        if (this.cache.size > this.MAX_CACHE_SIZE) {
            this.evictOldest();
        }
    }
    /**
     * Get a value from the cache
     */
    async get(key) {
        const entry = this.cache.get(key);
        if (!entry) {
            return null;
        }
        // Check if entry has expired
        if (entry.expiresAt < new Date()) {
            this.cache.delete(key);
            return null;
        }
        // Update last accessed time
        entry.lastAccessed = new Date();
        return entry.data;
    }
    /**
     * Delete a value from the cache
     */
    async delete(key) {
        this.cache.delete(key);
    }
    /**
     * Clear the entire cache
     */
    async clear() {
        this.cache.clear();
    }
    /**
     * Get the current cache size
     */
    size() {
        return this.cache.size;
    }
    /**
     * Check if the cache service is healthy
     */
    isHealthy() {
        return this.cache.size <= this.MAX_CACHE_SIZE;
    }
    /**
     * Start the cleanup interval
     */
    startCleanupInterval() {
        setInterval(() => {
            this.cleanup();
        }, this.CLEANUP_INTERVAL);
    }
    /**
     * Clean up expired entries
     */
    cleanup() {
        const now = new Date();
        for (const [key, entry] of this.cache.entries()) {
            if (entry.expiresAt < now) {
                this.cache.delete(key);
            }
        }
    }
    /**
     * Evict the oldest entries when cache is full
     */
    evictOldest() {
        const entries = Array.from(this.cache.entries());
        entries.sort((a, b) => a[1].lastAccessed.getTime() - b[1].lastAccessed.getTime());
        // Remove oldest 10% of entries
        const removeCount = Math.ceil(this.MAX_CACHE_SIZE * 0.1);
        entries.slice(0, removeCount).forEach(([key]) => {
            this.cache.delete(key);
        });
    }
    /**
     * Get data progressively with progress tracking
     */
    async getProgressively(key, fetchData, options = {}) {
        const cached = await this.get(key);
        if (cached) {
            return cached;
        }
        const data = await fetchData();
        if (Array.isArray(data)) {
            const chunkSize = options.chunkSize || 10;
            const chunks = Math.ceil(data.length / chunkSize);
            for (let i = 0; i < chunks; i++) {
                const progress = Math.min(Math.round(((i + 1) / chunks) * 100), 100);
                options.onProgress?.(progress);
                await new Promise(resolve => setTimeout(resolve, 0)); // Allow UI updates
            }
        }
        await this.set(key, data, { ttl: options.ttl });
        return data;
    }
}
// Export a singleton instance
export const cache = CacheService.getInstance();
//# sourceMappingURL=cache.service.js.map
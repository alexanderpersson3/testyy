import type { Request, Response, NextFunction } from '../types/index.js';
interface CacheOptions {
    ttl?: number;
    keyPrefix?: string;
    condition?: (req: Request) => boolean;
}
export declare const cacheMiddleware: (options?: CacheOptions) => (req: Request, res: Response, next: NextFunction) => Promise<any>;
/**
 * Clear cache entries
 */
export declare const clearCache: () => Promise<void>;
/**
 * Clear cache entry by key
 */
export declare const clearCacheKey: (key: string) => Promise<void>;
/**
 * Middleware to clear cache entries
 */
export declare const clearCacheMiddleware: () => (_req: Request, res: Response, next: NextFunction) => Promise<void>;
/**
 * Middleware to clear specific cache key
 */
export declare const clearCacheKeyMiddleware: (key: string) => (_req: Request, res: Response, next: NextFunction) => Promise<void>;
export {};

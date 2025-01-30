import { Request, Response, NextFunction } from 'express';
interface CacheOptions {
    duration: number;
    key?: string | ((req: Request) => string);
}
/**
 * Cache middleware for Express routes
 * @param options Cache options including duration (in seconds) and optional key generator
 */
export declare const cache: (options: CacheOptions) => (req: Request, res: Response, next: NextFunction) => void;
/**
 * Clear cache for a specific key or pattern
 * @param key Cache key or pattern to clear
 */
export declare const clearCache: (key: string) => void;
/**
 * Clear all cache
 */
export declare const clearAllCache: () => void;
export {};
//# sourceMappingURL=cache.d.ts.map
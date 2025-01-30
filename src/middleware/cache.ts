import { Request, Response, NextFunction } from 'express';
import mcache from 'memory-cache';

interface CacheOptions {
  duration: number;
  key?: string | ((req: Request) => string);
}

/**
 * Cache middleware for Express routes
 * @param options Cache options including duration (in seconds) and optional key generator
 */
export const cache = (options: CacheOptions) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const key = typeof options.key === 'function'
      ? options.key(req)
      : options.key || req.originalUrl;

    const cachedBody = mcache.get(key);

    if (cachedBody) {
      res.send(cachedBody);
      return;
    }

    const originalSend = res.send.bind(res);
    res.send = ((body: any): Response => {
      mcache.put(key, body, options.duration * 1000);
      return originalSend(body);
    }) as any;

    next();
  };
};

/**
 * Clear cache for a specific key or pattern
 * @param key Cache key or pattern to clear
 */
export const clearCache = (key: string): void => {
  mcache.del(key);
};

/**
 * Clear all cache
 */
export const clearAllCache = (): void => {
  mcache.clear();
}; 
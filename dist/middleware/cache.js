import { cache } from '../services/cache.service.js';
import { logger } from '../services/logging.service.js';
import { AppError } from '../utils/error.js';
class CacheError extends AppError {
    constructor(message, cause) {
        super(message, 500);
        this.cause = cause;
    }
}
const DEFAULT_OPTIONS = {
    ttl: 300, // 5 minutes
    keyPrefix: 'api:',
    condition: () => true,
};
/**
 * Generate cache key from request
 */
const generateCacheKey = (req, keyPrefix = DEFAULT_OPTIONS.keyPrefix) => {
    try {
        const parts = [
            keyPrefix.replace(/[:]/g, '_'),
            req.method,
            (req.originalUrl || req.url).replace(/[:]/g, '_'),
            Object.keys(req.query).length ? hash(JSON.stringify(req.query)) : '',
            Object.keys(req.body || {}).length ? hash(JSON.stringify(req.body)) : ''
        ].filter(Boolean);
        // Add user ID if authenticated
        const authReq = req;
        if (authReq.user?.id) {
            parts.push(authReq.user.id.replace(/[:]/g, '_'));
        }
        return parts.join(':');
    }
    catch (error) {
        throw new CacheError('Failed to generate cache key', error);
    }
};
/**
 * Cache middleware factory
 */
// Simple hash function for cache keys
function hash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return hash.toString(36);
}
export const cacheMiddleware = (options = {}) => {
    const { ttl, keyPrefix, condition } = { ...DEFAULT_OPTIONS, ...options };
    return async (req, res, next) => {
        // Skip caching based on condition
        if (!condition(req)) {
            return next();
        }
        const key = generateCacheKey(req, keyPrefix);
        try {
            const cachedResponse = await cache.get(key);
            if (cachedResponse && cachedResponse.createdAt) {
                // Check if cache is still valid based on TTL
                const age = Date.now() - cachedResponse.createdAt.getTime();
                if (age > ttl * 1000) {
                    await cache.delete(key);
                }
                else {
                    // Restore headers
                    Object.entries(cachedResponse.headers).forEach(([name, value]) => {
                        res.setHeader(name, value);
                    });
                    // Send cached response
                    res.setHeader('X-Cache', 'HIT');
                    res.setHeader('X-Cache-Age', Math.floor(age / 1000).toString());
                    return res.status(cachedResponse.statusCode).json(cachedResponse.data);
                }
            }
            const originalJson = res.json.bind(res);
            res.json = function (body) {
                res.json = originalJson;
                const responseToCache = {
                    statusCode: res.statusCode,
                    data: body,
                    headers: {},
                    createdAt: new Date()
                };
                // Only cache successful responses
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    res.setHeader('X-Cache', 'MISS');
                    cache
                        .set(key, responseToCache, { ttl })
                        .catch((err) => logger.error('Failed to cache response:', err));
                }
                // Send the response
                return originalJson.call(res, body);
            };
            next();
        }
        catch (err) {
            const error = err instanceof Error ? err : new Error('Unknown cache error');
            logger.error('Cache middleware error:', error);
            next();
        }
    };
};
/**
 * Clear cache entries
 */
export const clearCache = async () => {
    try {
        await cache.clear();
        logger.info('Cleared all cache entries');
    }
    catch (err) {
        const error = err instanceof Error ? err : new Error('Unknown cache error');
        throw new CacheError('Failed to clear cache', error);
    }
};
/**
 * Clear cache entry by key
 */
export const clearCacheKey = async (key) => {
    try {
        await cache.delete(key);
        logger.info(`Cleared cache entry: ${key}`);
    }
    catch (err) {
        const error = err instanceof Error ? err : new Error('Unknown cache error');
        throw new CacheError(`Failed to clear cache key: ${key}`, error);
    }
};
/**
 * Middleware to clear cache entries
 */
export const clearCacheMiddleware = () => {
    return async (_req, res, next) => {
        try {
            await clearCache();
            res.setHeader('X-Cache-Cleared', 'all');
            next();
        }
        catch (err) {
            const error = err instanceof Error ? err : new Error('Unknown cache error');
            logger.error('Clear cache middleware error:', error);
            next(new CacheError('Failed to clear cache', error));
        }
    };
};
/**
 * Middleware to clear specific cache key
 */
export const clearCacheKeyMiddleware = (key) => {
    return async (_req, res, next) => {
        try {
            await clearCacheKey(key);
            res.setHeader('X-Cache-Cleared', key);
            next();
        }
        catch (err) {
            const error = err instanceof Error ? err : new Error('Unknown cache error');
            logger.error('Clear cache key middleware error:', error);
            next(new CacheError(`Failed to clear cache key: ${key}`, error));
        }
    };
};
//# sourceMappingURL=cache.js.map
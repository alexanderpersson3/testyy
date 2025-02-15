import Redis from 'ioredis';
import { createHash } from 'crypto';
import { trackDatabaseOperation } from '../utils/performance-logger.js';
import { createStructuredLogFunc } from '../config/cloud.js';
import { Request, Response, NextFunction } from 'express';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

// Cache configuration
const CACHE_TTL = {
  SHORT: 300, // 5 minutes
  MEDIUM: 1800, // 30 minutes
  LONG: 86400, // 24 hours
};

// Cache key patterns
const KEY_PATTERNS = {
  USER: 'user:*',
  RECIPE: 'recipe:*',
  INGREDIENT: 'ingredient:*',
  SEARCH: 'search:*',
  ANALYTICS: 'analytics:*',
};

// Generate cache key from request
const generateCacheKey = (req: Request): string => {
  const data = {
    path: req.path,
    query: req.query,
    params: req.params,
    userId: (req as any).userId,
  };
  const key = createHash('sha256').update(JSON.stringify(data)).digest('hex');
  const prefix = req.path.split('/')[1] || 'general';
  return `${prefix}:${key}`;
};

interface CacheOptions {
    ttl?: number;
    keyPrefix?: string;
    condition?: (req: Request) => boolean;
}

// Cache middleware factory with performance tracking
export const cacheMiddleware = (options: CacheOptions = {}) => {
  const { ttl = CACHE_TTL.MEDIUM, keyPrefix = 'cache:', condition = () => true } = options;

  return async (req: Request, res: Response, next: NextFunction) => {
    if (req.method !== 'GET' || !condition(req)) {
      return next();
    }

    const cacheKey = keyPrefix + generateCacheKey(req);

    try {
      // Try to get cached response with performance tracking
      const cachedResponse = await trackDatabaseOperation(
        'cache_get',
        async () => {
          return redis.get(cacheKey);
        },
        { key: cacheKey }
      );

      if (cachedResponse) {
        const data = JSON.parse(cachedResponse);
        createStructuredLogFunc('cache_hit', {
          key: cacheKey,
          size: cachedResponse.length,
        });
        return res.json(data);
      }

      createStructuredLogFunc('cache_miss', { key: cacheKey });

      // Store original json method
      const originalJson = res.json;

      // Override json method to cache response with performance tracking
      res.json = function (data) {
        trackDatabaseOperation(
          'cache_set',
          async () => {
            const value = JSON.stringify(data);
            await redis.setex(cacheKey, ttl, value);
            createStructuredLogFunc('cache_store', {
              key: cacheKey,
              size: value.length,
              ttl,
            });
          },
          { key: cacheKey, ttl }
        );

        return originalJson.call(this, data);
      };

      next();
    } catch (error) {
      createStructuredLogFunc('cache_error', {
        error: (error as Error).message,
        stack: (error as Error).stack,
        key: cacheKey,
      });
      next();
    }
  };
};

// Cache invalidation helper with performance tracking
export const invalidateCache = async (pattern: string): Promise<number> => {
  return trackDatabaseOperation(
    'cache_invalidate',
    async () => {
      const keys = await redis.keys(pattern);
      if (keys.length > 0) {
        await redis.del(...keys);
        createStructuredLogFunc('cache_invalidate', {
          pattern,
          keysRemoved: keys.length,
        });
      }
      return keys.length;
    },
    { pattern }
  );
};

// Batch cache operations with performance tracking
export const batchGetCache = async (keys: string[]): Promise<(any | null)[]> => {
  return trackDatabaseOperation(
    'cache_batch_get',
    async () => {
      const values = await redis.mget(keys);
      const results = values.map(v => (v ? JSON.parse(v) : null));

      createStructuredLogFunc('cache_batch_get', {
        keys: keys.length,
        hits: results.filter(v => v !== null).length,
      });

      return results;
    },
    { keys: keys.length }
  );
};

// Cache warming helper with performance tracking
export const warmCache = async <T>(key: string, ttl: number, dataFn: () => Promise<T>): Promise<T> => {
  return trackDatabaseOperation(
    'cache_warm',
    async () => {
      const data = await dataFn();
      if (data) {
        const value = JSON.stringify(data);
        await redis.setex(key, ttl, value);

        createStructuredLogFunc('cache_warm', {
          key,
          size: value.length,
          ttl,
        });
      }
      return data;
    },
    { key, ttl }
  );
};

interface CacheStats {
    hits: number;
    misses: number;
    keys: number;
    memoryUsage: number;
    hitRate: number;
}

// Cache stats helper with performance tracking
export const getCacheStats = async (): Promise<CacheStats> => {
  return trackDatabaseOperation('cache_stats', async () => {
    const info = await redis.info();
    const stats: CacheStats = {
      hits: 0,
      misses: 0,
      keys: 0,
      memoryUsage: 0,
      hitRate: 0,
    };

    // Parse Redis INFO command output
    info.split('\n').forEach(line => {
      if (line.includes('keyspace_hits')) {
        stats.hits = parseInt(line.split(':')[1]);
      } else if (line.includes('keyspace_misses')) {
        stats.misses = parseInt(line.split(':')[1]);
      } else if (line.includes('used_memory')) {
        stats.memoryUsage = parseInt(line.split(':')[1]);
      }
    });

    stats.keys = parseInt(await redis.dbsize() as any);
    stats.hitRate = stats.hits / (stats.hits + stats.misses) || 0;

    createStructuredLogFunc('cache_stats', stats);
    return stats;
  });
};

// Export cache patterns
export const PATTERNS = KEY_PATTERNS;
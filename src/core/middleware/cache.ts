import { Request, Response, NextFunction } from 'express';
import Redis from 'ioredis';
import { createHash } from 'crypto';
import { trackCacheOperation } from '../../core/utils/performance-logger';
import { createStructuredLog, LogType } from '../../config/cloud';

// Cache configuration
const CACHE_TTL = {
  SHORT: 300, // 5 minutes
  MEDIUM: 1800, // 30 minutes
  LONG: 86400, // 24 hours
} as const;

// Cache key patterns
const KEY_PATTERNS = {
  USER: 'user:*',
  RECIPE: 'recipe:*',
  INGREDIENT: 'ingredient:*',
  SEARCH: 'search:*',
  ANALYTICS: 'analytics:*',
} as const;

// Types
type CacheTTL = typeof CACHE_TTL[keyof typeof CACHE_TTL];
type KeyPattern = typeof KEY_PATTERNS[keyof typeof KEY_PATTERNS];

interface CacheOptions {
  ttl?: CacheTTL;
  keyPrefix?: string;
  condition?: (req: Request) => boolean;
}

interface CacheStats {
  hits: number;
  misses: number;
  keys: number;
  memoryUsage: number;
  hitRate: number;
}

// Redis client
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379') as Redis & {
  keys(pattern: string): Promise<string[]>;
  mget(...keys: string[]): Promise<(string | null)[]>;
  info(): Promise<string>;
  dbsize(): Promise<number>;
};

// Generate cache key from request
const generateCacheKey = (req: Request): string => {
  const data = {
    path: req.path,
    query: req.query,
    params: req.params,
    userId: req.userId,
  };
  const key = createHash('sha256').update(JSON.stringify(data)).digest('hex');
  const prefix = req.path.split('/')[1] || 'general';
  return `${prefix}:${key}`;
};

// Cache middleware factory with performance tracking
export const cacheMiddleware = (options: CacheOptions = {}) => {
  const { ttl = CACHE_TTL.MEDIUM, keyPrefix = 'cache:', condition = () => true } = options;

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (req.method !== 'GET' || !condition(req)) {
      next();
      return;
    }

    const cacheKey = keyPrefix + generateCacheKey(req);

    try {
      // Try to get cached response with performance tracking
      const cachedResponse = await trackCacheOperation(
        'cache_get',
        async () => {
          return redis.get(cacheKey);
        },
        { key: cacheKey }
      );

      if (cachedResponse) {
        const data = JSON.parse(cachedResponse);
        createStructuredLog('cache_hit' as LogType, {
          key: cacheKey,
          size: cachedResponse.length,
        });
        res.json(data);
        return;
      }

      createStructuredLog('cache_miss' as LogType, { key: cacheKey });

      // Store original json method
      const originalJson = res.json;

      // Override json method to cache response with performance tracking
      res.json = function (data: any) {
        trackCacheOperation(
          'cache_set',
          async () => {
            const value = JSON.stringify(data);
            await redis.setex(cacheKey, ttl, value);
            createStructuredLog('cache_store' as LogType, {
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
      createStructuredLog('cache_error' as LogType, {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        key: cacheKey,
      });
      next();
    }
  };
};

// Cache invalidation helper with performance tracking
export const invalidateCache = async (pattern: KeyPattern): Promise<number> => {
  return trackCacheOperation(
    'cache_invalidate',
    async () => {
      const keys = await redis.keys(pattern);
      if (keys.length > 0) {
        await redis.del(keys);
        createStructuredLog('cache_invalidate' as LogType, {
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
export const batchGetCache = async <T>(keys: string[]): Promise<(T | null)[]> => {
  return trackCacheOperation(
    'cache_batch_get',
    async () => {
      const values = await redis.mget(...keys);
      const results = values.map((value: string | null) => (value ? JSON.parse(value) as T : null));

      createStructuredLog('cache_batch_get' as LogType, {
        keys: keys.length,
        hits: results.filter((value: T | null) => value !== null).length,
      });

      return results;
    },
    { keys: keys.length }
  );
};

// Cache warming helper with performance tracking
export const warmCache = async <T>(key: string, ttl: CacheTTL, dataFn: () => Promise<T>): Promise<T | null> => {
  return trackCacheOperation(
    'cache_warm',
    async () => {
      const data = await dataFn();
      if (data) {
        const value = JSON.stringify(data);
        await redis.setex(key, ttl, value);

        createStructuredLog('cache_warm' as LogType, {
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

// Cache stats helper with performance tracking
export const getCacheStats = async (): Promise<CacheStats> => {
  return trackCacheOperation('cache_stats', async () => {
    const info = await redis.info();
    const stats: CacheStats = {
      hits: 0,
      misses: 0,
      keys: 0,
      memoryUsage: 0,
      hitRate: 0,
    };

    // Parse Redis INFO command output
    info.split('\n').forEach((line: string) => {
      if (line.includes('keyspace_hits')) {
        stats.hits = parseInt(line.split(':')[1]);
      } else if (line.includes('keyspace_misses')) {
        stats.misses = parseInt(line.split(':')[1]);
      } else if (line.includes('used_memory')) {
        stats.memoryUsage = parseInt(line.split(':')[1]);
      }
    });

    stats.keys = await redis.dbsize();
    stats.hitRate = stats.hits / (stats.hits + stats.misses) || 0;

    createStructuredLog('cache_stats' as LogType, stats);
    return stats;
  });
};

// Export cache patterns
export const PATTERNS = KEY_PATTERNS;
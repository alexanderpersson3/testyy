import Redis from 'ioredis';
import { createHash } from 'crypto';
import { trackCacheOperation } from '../utils/performance-logger.js';
import { createStructuredLog } from '../config/cloud.js';

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
const generateCacheKey = req => {
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
export const cacheMiddleware = (options = {}) => {
  const { ttl = CACHE_TTL.MEDIUM, keyPrefix = 'cache:', condition = () => true } = options;

  return async (req, res, next) => {
    if (req.method !== 'GET' || !condition(req)) {
      return next();
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
        createStructuredLog('cache_hit', {
          key: cacheKey,
          size: cachedResponse.length,
        });
        return res.json(data);
      }

      createStructuredLog('cache_miss', { key: cacheKey });

      // Store original json method
      const originalJson = res.json;

      // Override json method to cache response with performance tracking
      res.json = function (data) {
        trackCacheOperation(
          'cache_set',
          async () => {
            const value = JSON.stringify(data);
            await redis.setex(cacheKey, ttl, value);
            createStructuredLog('cache_store', {
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
      createStructuredLog('cache_error', {
        error: error.message,
        stack: error.stack,
        key: cacheKey,
      });
      next();
    }
  };
};

// Cache invalidation helper with performance tracking
export const invalidateCache = async pattern => {
  return trackCacheOperation(
    'cache_invalidate',
    async () => {
      const keys = await redis.keys(pattern);
      if (keys.length > 0) {
        await redis.del(...keys);
        createStructuredLog('cache_invalidate', {
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
export const batchGetCache = async keys => {
  return trackCacheOperation(
    'cache_batch_get',
    async () => {
      const values = await redis.mget(keys);
      const results = values.map(v => (v ? JSON.parse(v) : null));

      createStructuredLog('cache_batch_get', {
        keys: keys.length,
        hits: results.filter(v => v !== null).length,
      });

      return results;
    },
    { keys: keys.length }
  );
};

// Cache warming helper with performance tracking
export const warmCache = async (key, ttl, dataFn) => {
  return trackCacheOperation(
    'cache_warm',
    async () => {
      const data = await dataFn();
      if (data) {
        const value = JSON.stringify(data);
        await redis.setex(key, ttl, value);

        createStructuredLog('cache_warm', {
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
export const getCacheStats = async () => {
  return trackCacheOperation('cache_stats', async () => {
    const info = await redis.info();
    const stats = {
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

    stats.keys = parseInt(await redis.dbsize());
    stats.hitRate = stats.hits / (stats.hits + stats.misses) || 0;

    createStructuredLog('cache_stats', stats);
    return stats;
  });
};

// Export cache patterns
export const PATTERNS = KEY_PATTERNS;

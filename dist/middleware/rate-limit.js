import { createClient } from 'redis';
import { RateLimitError } from '../utils/errors.js';
import logger from '../utils/logger.js';
const redisConfig = {
    url: `redis://${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || '6379'}`,
    password: process.env.REDIS_PASSWORD,
    database: parseInt(process.env.REDIS_DB || '0', 10),
};
const redis = createClient(redisConfig);
// Connect to Redis
redis.connect().catch(err => {
    logger.error('Redis connection error:', err);
    process.exit(1);
});
const defaultOptions = {
    windowMs: 60 * 1000, // 1 minute
    max: 100, // limit each IP to 100 requests per windowMs
    keyPrefix: 'rl:', // redis key prefix
    skipFailedRequests: false,
    requestPropertyName: 'rateLimit',
};
export const rateLimitMiddleware = {
    auth: (options = {}) => {
        const opts = {
            ...defaultOptions,
            ...options,
            keyPrefix: 'rl:auth:',
            max: 5,
            windowMs: 15 * 60 * 1000, // 15 minutes
        };
        return createRateLimiter(opts);
    },
    api: (options = {}) => {
        const opts = {
            ...defaultOptions,
            ...options,
            keyPrefix: 'rl:api:',
            max: 60,
            windowMs: 60 * 1000, // 1 minute
        };
        return createRateLimiter(opts);
    },
    custom: (options) => {
        const opts = {
            ...defaultOptions,
            ...options,
        };
        return createRateLimiter(opts);
    },
};
function createRateLimiter(options) {
    return async (req, res, next) => {
        try {
            // Get client IP, fallback to 'unknown' if not available
            const clientIp = req.ip || 'unknown';
            const key = options.keyPrefix + clientIp;
            // Use multi for atomic operations
            const multi = redis.multi();
            multi.incr(key);
            multi.ttl(key);
            const [count, ttl] = await multi.exec();
            // Set expiry for new keys
            if (ttl === -1) {
                await redis.expire(key, Math.floor(options.windowMs / 1000));
            }
            // Set headers
            res.setHeader('X-RateLimit-Limit', options.max);
            res.setHeader('X-RateLimit-Remaining', Math.max(0, options.max - count));
            res.setHeader('X-RateLimit-Reset', Date.now() + ttl * 1000);
            // Check if over limit
            if (count > options.max) {
                if (options.handler) {
                    options.handler(req, res);
                    return;
                }
                throw new RateLimitError('Too many requests');
            }
            // Attach rate limit info to request
            if (options.requestPropertyName) {
                req[options.requestPropertyName] = {
                    limit: options.max,
                    current: count,
                    remaining: Math.max(0, options.max - count),
                    resetTime: Date.now() + ttl * 1000,
                };
            }
            next();
        }
        catch (error) {
            logger.error('Rate limit error:', error);
            next(error);
        }
    };
}
/**
 * Clean up rate limit data
 */
export async function cleanupRateLimits() {
    try {
        // Get all rate limit keys
        const keys = await redis.keys('rate-limit:*');
        // Delete keys if we have any
        if (keys.length > 0) {
            await redis.del(keys);
        }
    }
    catch (error) {
        logger.error('Failed to cleanup rate limits:', error);
    }
}
//# sourceMappingURL=rate-limit.js.map
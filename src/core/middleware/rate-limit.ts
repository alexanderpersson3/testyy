import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import Redis from 'ioredis';
import { Request, Response } from 'express';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

interface TokenBucketLimiterOptions {
  windowMs?: number;
  max?: number;
  message?: string;
  statusCode?: number;
  keyPrefix?: string;
}

// Token bucket configuration
const createTokenBucketLimiter = (options: TokenBucketLimiterOptions = {}) => {
  const {
    windowMs = 15 * 60 * 1000, // 15 minutes
    max = 100, // Limit each IP to 100 requests per windowMs
    message = 'Too many requests from this IP, please try again later',
    statusCode = 429,
    keyPrefix = 'ratelimit',
  } = options;

  return rateLimit({
    store: new RedisStore({
      client: redis,
      prefix: keyPrefix,
      // Implement token bucket algorithm
      tokenBucket: {
        tokensPerInterval: max,
        interval: windowMs,
        burstSize: Math.floor(max * 0.1), // Allow 10% burst
      },
    } as any),
    windowMs,
    max,
    message: {
      status: 'error',
      message,
      retryAfter: windowMs / 1000, // seconds
    },
    statusCode,
    headers: true, // Send X-RateLimit headers
    skipFailedRequests: false,
    skipSuccessfulRequests: false,
    keyGenerator: (req: Request) => {
      // Use both IP and user ID (if available) for rate limiting
      return (req as any).user ? `${req.ip || 'anonymous'}-${(req as any).user.id}` : (req.ip || 'anonymous');
    },
    handler: (req: Request, res: Response) => {
      res.status(statusCode).json({
        status: 'error',
        message,
        retryAfter: Math.ceil(windowMs / 1000),
      });
    },
  });
};

// Different rate limits for different routes
const rateLimiters = {
  // Strict limiting for authentication routes
  auth: createTokenBucketLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 requests per 15 minutes
    message: 'Too many authentication attempts, please try again later',
    keyPrefix: 'ratelimit:auth',
  }),

  // Standard API rate limiting
  api: createTokenBucketLimiter({
    windowMs: 60 * 1000, // 1 minute
    max: 60, // 60 requests per minute
    keyPrefix: 'ratelimit:api',
  }),

  // More lenient rate limiting for public routes
  public: createTokenBucketLimiter({
    windowMs: 60 * 1000, // 1 minute
    max: 120, // 120 requests per minute
    keyPrefix: 'ratelimit:public',
  }),
};

export default rateLimiters;
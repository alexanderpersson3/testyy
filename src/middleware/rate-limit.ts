import rateLimit, { Options, RateLimitRequestHandler } from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { redis } from '../lib/redis.js';

interface RateLimitConfig {
  windowMs: number;
  max: number;
  message: string;
}

const RATE_LIMIT_CONFIGS = {
  auth: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 requests per windowMs
    message: 'Too many authentication attempts, please try again later.'
  },
  api: {
    windowMs: 60 * 1000, // 1 minute
    max: 60, // 60 requests per windowMs
    message: 'Too many requests, please try again later.'
  },
  scraping: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 100, // 100 requests per windowMs
    message: 'Rate limit exceeded for price scraping.'
  }
} satisfies Record<string, RateLimitConfig>;

const createLimiter = (config: RateLimitConfig): RateLimitRequestHandler => {
  const store = redis ? new RedisStore({
    prefix: 'rate-limit:',
    // @ts-expect-error - Redis client type mismatch
    client: redis,
    resetExpiryOnChange: true,
    // Use a longer expiry than windowMs to ensure we keep the data long enough
    expiry: Math.floor(config.windowMs / 1000) * 2
  }) : undefined;

  return rateLimit({
    windowMs: config.windowMs,
    max: config.max,
    message: { success: false, message: config.message },
    standardHeaders: true,
    legacyHeaders: false,
    store
  });
};

interface RateLimitMiddleware {
  auth: () => RateLimitRequestHandler;
  api: () => RateLimitRequestHandler;
  scraping: () => RateLimitRequestHandler;
  custom: (config: RateLimitConfig) => RateLimitRequestHandler;
}

export const rateLimitMiddleware: RateLimitMiddleware = {
  auth: () => createLimiter(RATE_LIMIT_CONFIGS.auth),
  api: () => createLimiter(RATE_LIMIT_CONFIGS.api),
  scraping: () => createLimiter(RATE_LIMIT_CONFIGS.scraping),
  custom: (config: RateLimitConfig) => createLimiter(config)
};

// For backward compatibility
export const rateLimiter = rateLimitMiddleware; 
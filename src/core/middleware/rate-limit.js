const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');
const Redis = require('ioredis');

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

// Token bucket configuration
const createTokenBucketLimiter = (options = {}) => {
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
    }),
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
    keyGenerator: req => {
      // Use both IP and user ID (if available) for rate limiting
      return req.user ? `${req.ip}-${req.user.id}` : req.ip;
    },
    handler: (req, res) => {
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

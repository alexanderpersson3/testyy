import rateLimit from 'express-rate-limit';
import { config } from '../../config';

export const rateLimitMiddleware = {
  // API rate limiting
  api: () => rateLimit({
    windowMs: config.security.RATE_LIMIT.WINDOW_MS,
    max: config.security.RATE_LIMIT.MAX_REQUESTS,
    message: {
      status: 'error',
      message: 'Too many requests, please try again later.',
    },
    standardHeaders: true,
    legacyHeaders: false,
  }),

  // Auth rate limiting (more strict)
  auth: rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 requests per window
    message: {
      status: 'error',
      message: 'Too many authentication attempts, please try again later.',
    },
    standardHeaders: true,
    legacyHeaders: false,
  }),

  // Public endpoints (more lenient)
  public: rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 30, // 30 requests per minute
    message: {
      status: 'error',
      message: 'Too many requests, please try again later.',
    },
    standardHeaders: true,
    legacyHeaders: false,
  })
};

export const cleanupRateLimits = () => {
  // Implementation for cleaning up rate limit data
  // This could be used to clear rate limit counters in tests or maintenance
}; 
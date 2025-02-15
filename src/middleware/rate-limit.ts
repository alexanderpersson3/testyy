import rateLimit from 'express-rate-limit';
import { config } from '../config';

export const rateLimiter = rateLimit({
  windowMs: config.security.RATE_LIMIT.WINDOW_MS,
  max: config.security.RATE_LIMIT.MAX_REQUESTS,
  message: {
    status: 'error',
    message: 'Too many requests, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
}); 
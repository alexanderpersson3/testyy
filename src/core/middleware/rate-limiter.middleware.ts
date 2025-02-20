import { Request, Response, NextFunction } from 'express';
import { injectable, inject } from 'inversify';
import { TYPES } from '../types/constants';
import { LoggerService } from '../services/logger.service';
import { RateLimiterService, RateLimitType } from '../services/rate-limiter.service';
import { RateLimitError } from '../errors/base.error';
import { RateLimitRequestHandler } from 'express-rate-limit';
import rateLimit from 'express-rate-limit';
import { TypedRequest, TypedResponse, TypedRequestHandler } from '@/types/express';

@injectable()
export class RateLimiterMiddleware {
  private readonly rateLimiterService: RateLimiterService;

  constructor(
    @inject(TYPES.LoggerService) private readonly logger: LoggerService
  ) {
    this.rateLimiterService = new RateLimiterService(logger);
  }

  /**
   * Creates a rate limiter middleware for a specific endpoint
   * @param type The type of rate limit to apply
   * @returns Rate limiter middleware
   */
  public createLimiter(type: RateLimitType): TypedRequestHandler {
    const limiter = this.rateLimiterService.createLimiter(this.rateLimiterService['defaultLimits'][type]);
    return (req, res, next) => limiter(req as any, res as any, next);
  }
}

// Create default rate limiter instance
const defaultRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false
});

// Export factory function for creating rate limiter instances
export const createTypedRateLimiter = (type: RateLimitType): TypedRequestHandler => {
  const service = new RateLimiterService(new LoggerService());
  const limiter = service.createLimiter(service['defaultLimits'][type]);
  return (req, res, next) => limiter(req as any, res as any, next);
};

// Export singleton instance for backward compatibility
export { RateLimiterService };

// Export the factory function as the default rate limiter
export { createTypedRateLimiter as rateLimiter }; 
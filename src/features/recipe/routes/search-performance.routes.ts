import { Router } from 'express';;
import type { Response } from '../types/express.js';
import type { Router } from '../types/express.js';;
import { ObjectId } from 'mongodb';;;;
import { z } from 'zod';;
import { SearchPerformanceService } from '../services/search-performance.service.js';;
import { auth, isAdmin } from '../middleware/auth.js';;
import type { validateRequest } from '../types/express.js';
import { rateLimitMiddleware } from '../middleware/rate-limit.js';;
import { asyncHandler } from '../utils/asyncHandler.js';;
import { DatabaseError, ValidationError, ForbiddenError } from '../utils/errors.js';;
import logger from '../utils/logger.js';
import type { AuthenticatedRequest } from '../types/express.js';
const router = Router();
const performanceService = SearchPerformanceService.getInstance();

// Validation schemas
const dateSchema = z.string().datetime({
  message: 'Invalid date format. Please use ISO 8601 format (e.g. 2024-03-20T00:00:00Z)',
});

const getMetricsSchema = z.object({
  startDate: dateSchema,
  endDate: dateSchema,
});

// Add validation function separately
const validateDates = (data: { startDate: string; endDate: string }) => {
  const start = new Date(data.startDate);
  const end = new Date(data.endDate);
  if (start > end) {
    throw new ValidationError('Start date must be before or equal to end date');
  }
  return data;
};

const getRealTimeMetricsSchema = z.object({
  minutes: z
    .string()
    .transform(val => parseInt(val, 10))
    .pipe(
      z.number()
        .int('Minutes must be an integer')
        .min(1, 'Minutes must be at least 1')
        .max(60, 'Minutes cannot exceed 60')
    )
    .default('5'),
});

// Get performance metrics
router.get(
  '/metrics',
  auth,
  isAdmin,
  rateLimitMiddleware.api(),
  validateRequest(getMetricsSchema, 'query'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
      throw new ValidationError('Authentication required');
    }

    try {
      const { startDate, endDate } = validateDates(req.query as { startDate: string; endDate: string });
      const metrics = await performanceService.getPerformanceMetrics(
        new Date(startDate),
        new Date(endDate)
      );
      res.json(metrics);
    } catch (error) {
      logger.error('Failed to get performance metrics:', error);
      throw new DatabaseError('Failed to get performance metrics');
    }
  })
);

// Get real-time metrics
router.get(
  '/metrics/realtime',
  auth,
  isAdmin,
  rateLimitMiddleware.api(),
  validateRequest(getRealTimeMetricsSchema, 'query'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
      throw new ValidationError('Authentication required');
    }

    try {
      const minutes = parseInt((req.query.minutes as string) || '5', 10);
      const metrics = await performanceService.getRealTimeMetrics(minutes);
      res.json(metrics);
    } catch (error) {
      logger.error('Failed to get real-time metrics:', error);
      throw new DatabaseError('Failed to get real-time metrics');
    }
  })
);

export default router;

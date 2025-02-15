import { Router } from 'express';;
import type { Response } from '../types/express.js';
import type { Router } from '../types/express.js';;
import { z } from 'zod';;
import type { validateRequest } from '../types/express.js';
import { AnalyticsService } from '../services/analytics.service.js';;
import { MonitoringService } from '../services/monitoring.service.js';;
import type { AuthenticatedRequest } from '../types/express.js';
import { ObjectId } from 'mongodb';;;;
import { auth } from '../middleware/auth.js';;
import { DatabaseError, ValidationError } from '../utils/errors.js';;
import logger from '../utils/logger.js';
import { asyncHandler } from '../utils/asyncHandler.js';;
import { rateLimitMiddleware } from '../middleware/rate-limit.js';;

const router = Router();
const analyticsService = AnalyticsService.getInstance();
const monitoringService = new MonitoringService();

// Validation schemas
const dateRangeSchema = z.object({
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
});

// Get activity timeline
router.get(
  '/activity',
  auth,
  rateLimitMiddleware.api(),
  validateRequest(dateRangeSchema.partial()),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
      throw new ValidationError('Authentication required');
    }

    try {
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;
      
      const timeline = await analyticsService.getActivityTimeline(new ObjectId(req.user.id), {
        startDate,
        endDate
      });
      res.json(timeline);
    } catch (error) {
      logger.error('Failed to get activity timeline:', error);
      throw new DatabaseError('Failed to get activity timeline');
    }
  })
);

// Get usage metrics
router.get(
  '/usage',
  auth,
  rateLimitMiddleware.api(),
  validateRequest(z.object({
    period: z.enum(['day', 'week', 'month'])
  })),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
      throw new ValidationError('Authentication required');
    }

    try {
      const metrics = await analyticsService.getUsageMetrics(new ObjectId(req.user.id), {
        period: req.query.period as 'day' | 'week' | 'month'
      });
      res.json(metrics);
    } catch (error) {
      logger.error('Failed to get usage metrics:', error);
      throw new DatabaseError('Failed to get usage metrics');
    }
  })
);

// Get cooking stats
router.get(
  '/cooking-stats',
  auth,
  rateLimitMiddleware.api(),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
      throw new ValidationError('Authentication required');
    }

    try {
      const stats = await analyticsService.getCookingStats(new ObjectId(req.user.id));
      res.json(stats);
    } catch (error) {
      logger.error('Failed to get cooking stats:', error);
      throw new DatabaseError('Failed to get cooking stats');
    }
  })
);

// Get endpoint metrics
router.get(
  '/endpoint-metrics',
  auth,
  rateLimitMiddleware.api(),
  validateRequest(dateRangeSchema),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
      throw new ValidationError('Authentication required');
    }

    try {
      const startDate = new Date(req.query.startDate as string);
      const endDate = new Date(req.query.endDate as string);
      const metrics = await monitoringService.getEndpointMetrics(startDate, endDate);
      res.json(metrics);
    } catch (error) {
      logger.error('Failed to get endpoint metrics:', error);
      throw new DatabaseError('Failed to get endpoint metrics');
    }
  })
);

// Get system metrics
router.get(
  '/system-metrics',
  auth,
  rateLimitMiddleware.api(),
  validateRequest(dateRangeSchema),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
      throw new ValidationError('Authentication required');
    }

    try {
      const startDate = new Date(req.query.startDate as string);
      const endDate = new Date(req.query.endDate as string);
      const metrics = await monitoringService.getSystemMetrics(startDate, endDate);
      res.json(metrics);
    } catch (error) {
      logger.error('Failed to get system metrics:', error);
      throw new DatabaseError('Failed to get system metrics');
    }
  })
);

// Get error distribution
router.get(
  '/error-distribution',
  auth,
  rateLimitMiddleware.api(),
  validateRequest(dateRangeSchema),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
      throw new ValidationError('Authentication required');
    }

    try {
      const startDate = new Date(req.query.startDate as string);
      const endDate = new Date(req.query.endDate as string);
      const distribution = await monitoringService.getErrorDistribution(startDate, endDate);
      res.json(distribution);
    } catch (error) {
      logger.error('Failed to get error distribution:', error);
      throw new DatabaseError('Failed to get error distribution');
    }
  })
);

// Get slow endpoints
router.get(
  '/slow-endpoints',
  auth,
  rateLimitMiddleware.api(),
  validateRequest(dateRangeSchema),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
      throw new ValidationError('Authentication required');
    }

    try {
      const startDate = new Date(req.query.startDate as string);
      const endDate = new Date(req.query.endDate as string);
      const slowEndpoints = await monitoringService.getSlowEndpoints(startDate, endDate);
      res.json(slowEndpoints);
    } catch (error) {
      logger.error('Failed to get slow endpoints:', error);
      throw new DatabaseError('Failed to get slow endpoints');
    }
  })
);

export default router;

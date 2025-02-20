import { Types } from 'mongoose';
import { auth } from '@/core/middleware/auth.middleware';
import { rateLimiter } from '@/core/middleware/rate-limiter.middleware';
import { UserAnalyticsService } from '@/features/shared/services/analytics/user-analytics.service';
import { authenticatedHandler } from '@/core/utils/async-handler';
import { validate } from '@/core/middleware/validate';
import { container } from '@/core/di/container';
import { TYPES } from '@/core/types/constants';
import { ParamsDictionary } from 'express-serve-static-core';
import { analyticsSchemas } from '@/core/validation/analytics.schema';
import {
  AnalyticsPreferences,
  CookingStats,
  UsageMetrics,
  AnalyticsEvent,
  FilterMetrics,
  CreateAnalyticsEventDTO,
  UpdateAnalyticsPreferencesDTO,
  CookingStatsInput
} from '@/core/types/domain/analytics.types';
import { ParsedQs } from 'qs';
import { RateLimitType } from '@/core/services/rate-limiter.service';
import { TypedAuthRequest, TypedResponse, RequestWithAuth } from '@/types/express';
import { createAuthRouter } from '@/core/utils/router';

interface DateRangeQuery extends ParsedQs {
  startDate: string;
  endDate: string;
}

const router = createAuthRouter();
const analyticsService = container.get<UserAnalyticsService>(TYPES.AnalyticsService);

// Usage & Metrics Routes
router.get(
  '/usage',
  auth,
  rateLimiter(RateLimitType.USER_ACTIONS),
  validate(analyticsSchemas.dateRange, 'query'),
  authenticatedHandler<ParamsDictionary, UsageMetrics[], never, DateRangeQuery>(
    async (req, res) => {
      const userId = new Types.ObjectId(req.user.id);
      const { startDate, endDate } = req.query;
      
      const metrics = await analyticsService.getUsageMetrics(userId, {
        start: new Date(String(startDate)),
        end: new Date(String(endDate))
      });
      res.json({ success: true, data: metrics });
    }
  )
);

// Cooking Stats Route
router.get(
  '/cooking-stats',
  auth,
  rateLimiter(RateLimitType.USER_ACTIONS),
  authenticatedHandler<ParamsDictionary, CookingStats>(
    async (req, res) => {
      const userId = new Types.ObjectId(req.user.id);
      const stats = await analyticsService.updateCookingStats(userId, {} as CookingStatsInput);
      res.json({ success: true, data: stats });
    }
  )
);

// Filter Metrics Route
router.get(
  '/filters',
  auth,
  rateLimiter(RateLimitType.USER_ACTIONS),
  validate(analyticsSchemas.dateRange, 'query'),
  authenticatedHandler<ParamsDictionary, FilterMetrics, never, DateRangeQuery>(
    async (req, res) => {
      const userId = new Types.ObjectId(req.user.id);
      const { startDate, endDate } = req.query;
      
      const metrics = await analyticsService.getFilterMetrics(
        new Date(String(startDate)),
        new Date(String(endDate))
      );
      res.json({ success: true, data: metrics });
    }
  )
);

// Analytics Preferences Routes
router.get(
  '/preferences',
  auth,
  rateLimiter(RateLimitType.USER_ACTIONS),
  authenticatedHandler<ParamsDictionary, AnalyticsPreferences>(
    async (req, res) => {
      const userId = new Types.ObjectId(req.user.id);
      const preferences = await analyticsService.updateAnalyticsPreferences(userId, {});
      res.json({ success: true, data: preferences });
    }
  )
);

router.put(
  '/preferences',
  auth,
  rateLimiter(RateLimitType.USER_ACTIONS),
  validate(analyticsSchemas.analyticsPreferences, 'body'),
  authenticatedHandler<ParamsDictionary, AnalyticsPreferences, UpdateAnalyticsPreferencesDTO>(
    async (req, res) => {
      const userId = new Types.ObjectId(req.user.id);
      const preferences = await analyticsService.updateAnalyticsPreferences(
        userId,
        req.body
      );
      res.json({ success: true, data: preferences });
    }
  )
);

// Log Analytics Event Route
router.post(
  '/events',
  auth,
  rateLimiter(RateLimitType.USER_ACTIONS),
  validate(analyticsSchemas.analyticsEvent, 'body'),
  authenticatedHandler<ParamsDictionary, AnalyticsEvent, CreateAnalyticsEventDTO>(
    async (req, res) => {
      const userId = new Types.ObjectId(req.user.id);
      const event = await analyticsService.logAnalyticsEvent(
        userId,
        req.body
      );
      res.json({ success: true, data: event });
    }
  )
);

export default router;

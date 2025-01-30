/**
 * Achievement routes for handling user achievements, badges, ranks, and tracking.
 * Provides endpoints for managing the gamification aspects of the application,
 * including leaderboards, user badges, and achievement tracking.
 * 
 * Known TypeScript Issue:
 * Express's type system has limitations with async route handlers returning Response objects.
 * This is a known issue (see: https://github.com/DefinitelyTyped/DefinitelyTyped/issues/50871).
 * We're using @ts-expect-error comments as a workaround until this is fixed in Express's types.
 * 
 * @module routes/social/achievements
 * @see .github/ISSUES/TS-001-express-async-handlers.md for detailed explanation
 */

import { Router, Request, Response, NextFunction, RequestHandler } from 'express';
import { z } from 'zod';
import { validate } from '../../middleware/validation.js';
import { auth } from '../../middleware/auth.js';
import { rateLimitMiddleware } from '../../middleware/rate-limit.js';
import achievementManager from '../../services/social/achievement-manager.js';
import { LeaderboardOptions, UserBadge, LeaderboardEntry, UserRank } from '../../types/achievement.js';
import { ParamsDictionary } from 'express-serve-static-core';
import { AuthenticatedRequest } from '../../types/auth.js';
import { AppError } from '../../middleware/error-handler.js';
import { ObjectId } from 'mongodb';
import { UserBadge as APIUserBadge } from '../../types/achievement';
import { UserBadge as ServiceUserBadge } from '../../services/social/achievement-manager';
import { RateLimitRequestHandler } from 'express-rate-limit';

const router = Router();

/**
 * Validation schema for leaderboard query parameters
 */
const leaderboardSchema = z.object({
  /** Type of metric to rank users by */
  metric: z.string(),
  /** Maximum number of entries to return (1-100) */
  limit: z.number().int().positive().optional(),
  /** Number of entries to skip for pagination */
  offset: z.number().int().nonnegative().optional()
}).strict();

/**
 * Interface for leaderboard query parameters
 */
interface LeaderboardQuery {
  metric?: string;
  limit?: number;
  offset?: number;
}

/**
 * Interface for user ID route parameters
 */
interface UserIdParams extends ParamsDictionary {
  userId: string;
}

/**
 * Interface for achievement tracking request body
 */
interface TrackAchievementBody {
  /** Type of achievement being tracked */
  achievementType: string;
  /** Value associated with the achievement */
  value: number;
}

/**
 * Get the global leaderboard
 * Returns a ranked list of users based on specified metrics
 * 
 * @route GET /leaderboard
 * @param {string} metric - Type of metric to rank by
 * @param {number} [limit=10] - Maximum number of entries
 * @param {number} [offset=0] - Number of entries to skip
 * @returns {LeaderboardEntry[]} List of ranked users
 * @throws {AppError} When rate limit is exceeded or invalid parameters
 */
const getLeaderboard: RequestHandler<{}, LeaderboardEntry[], any, LeaderboardQuery> = async (req, res, next) => {
  try {
    const { metric = 'recipes_created', limit, offset } = req.query;
    const leaderboard = await achievementManager.getLeaderboard(metric, { limit: Number(limit), offset: Number(offset) });
    res.json(leaderboard);
  } catch (error) {
    next(error);
  }
};

/**
 * Convert service badge to API badge
 * @param badge Service user badge
 * @param userId User ID
 * @returns API user badge
 */
const convertBadge = (badge: ServiceUserBadge, userId: string): APIUserBadge => ({
  userId: new ObjectId(userId),
  badgeId: new ObjectId(), // This should come from the badge data
  earnedAt: badge.earnedAt,
  level: badge.level === 1 ? 'bronze' : 
         badge.level === 2 ? 'silver' : 
         badge.level === 3 ? 'gold' : 'platinum'
});

/**
 * Get user badges
 * Returns all badges earned by a specific user
 * 
 * @route GET /badges/:userId
 * @param {string} userId - ID of the user
 * @returns {UserBadge[]} List of user's badges
 * @throws {AppError} When user not found or rate limit exceeded
 */
const getUserBadges: RequestHandler<UserIdParams, UserBadge[]> = async (req, res, next) => {
  try {
    const badges = await achievementManager.getUserBadges(req.params.userId);
    const responseBadges = badges.map(badge => convertBadge(badge, req.params.userId));
    res.json(responseBadges);
  } catch (error) {
    next(error);
  }
};

/**
 * Get user rank
 * Returns a user's current rank for a specific metric
 * 
 * @route GET /rank/:metric
 * @param {string} metric - Type of metric to get rank for
 * @returns {UserRank} User's rank information
 * @throws {AppError} When user not found or rate limit exceeded
 */
const getUserRank: RequestHandler<UserIdParams, UserRank> = async (req, res, next) => {
  try {
    const { metric } = req.params;
    const user = (req as AuthenticatedRequest).user;
    
    if (!user) {
      throw new Error('User not authenticated');
    }

    const rank = await achievementManager.getUserRank(user.id, metric);
    res.json(rank);
  } catch (error) {
    next(error);
  }
};

/**
 * Track achievement
 * Records progress towards an achievement for the authenticated user
 * 
 * @route POST /track
 * @param {TrackAchievementBody} body - Achievement details to track
 * @returns {Object} Updated achievement status
 * @throws {AppError} When invalid achievement type or rate limit exceeded
 */
const trackAchievement: RequestHandler<{}, any, TrackAchievementBody> = async (req, res, next) => {
  try {
    const user = (req as AuthenticatedRequest).user;
    
    if (!user) {
      throw new Error('User not authenticated');
    }

    const { achievementType, value } = req.body;
    const result = await achievementManager.trackAchievement(user.id, achievementType, value);
    const responseBadges = {
      badges: result.badges.map(badge => convertBadge(badge, user.id)),
      newBadges: result.newBadges.map(badge => convertBadge(badge, user.id))
    };
    res.json(responseBadges);
  } catch (error) {
    next(error);
  }
};

// Custom rate limiters
const leaderboardLimiter = rateLimitMiddleware.custom({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: 'Too many leaderboard requests, please try again later.'
});

const badgesLimiter = rateLimitMiddleware.custom({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: 'Too many badge requests, please try again later.'
});

const rankLimiter = rateLimitMiddleware.custom({
  windowMs: 60 * 1000, // 1 minute
  max: 30,
  message: 'Too many rank requests, please try again later.'
});

const trackLimiter = rateLimitMiddleware.custom({
  windowMs: 60 * 1000, // 1 minute
  max: 20,
  message: 'Too many achievement tracking requests, please try again later.'
});

// Route definitions with middleware
router.get('/leaderboard', 
  auth,
  leaderboardLimiter,
  validate({
    query: leaderboardSchema
  }),
  getLeaderboard
);

router.get('/badges',
  auth,
  badgesLimiter,
  getUserBadges
);

router.get(
  '/rank/:metric',
  auth,
  rankLimiter,
  validate({
    params: z.object({
      metric: z.string()
    })
  }),
  getUserRank
);

router.post(
  '/track',
  auth,
  trackLimiter,
  validate({
    body: z.object({
      achievementType: z.string(),
      value: z.number().int().positive()
    })
  }),
  trackAchievement
);

// Badge management endpoints with rate limiting
const apiLimiter: RateLimitRequestHandler = rateLimitMiddleware.api();

router.post(
  '/badges/claim',
  apiLimiter,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required'
          }
        });
      }

      const { badgeId } = req.body;
      if (!badgeId) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_INPUT',
            message: 'Badge ID is required'
          }
        });
      }

      // Implement badge claim logic here
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: {
          code: 'BADGE_ERROR',
          message: error instanceof Error ? error.message : 'Error claiming badge'
        }
      });
    }
  }
);

router.post(
  '/badges/share',
  apiLimiter,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required'
          }
        });
      }

      const { badgeId, platform } = req.body;
      if (!badgeId || !platform) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_INPUT',
            message: 'Badge ID and platform are required'
          }
        });
      }

      // Implement badge sharing logic here
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: {
          code: 'BADGE_ERROR',
          message: error instanceof Error ? error.message : 'Error sharing badge'
        }
      });
    }
  }
);

router.post(
  '/badges/favorite',
  apiLimiter,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required'
          }
        });
      }

      const { badgeId } = req.body;
      if (!badgeId) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_INPUT',
            message: 'Badge ID is required'
          }
        });
      }

      // Implement badge favorite logic here
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: {
          code: 'BADGE_ERROR',
          message: error instanceof Error ? error.message : 'Error favoriting badge'
        }
      });
    }
  }
);

router.post(
  '/badges/unfavorite',
  apiLimiter,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required'
          }
        });
      }

      const { badgeId } = req.body;
      if (!badgeId) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_INPUT',
            message: 'Badge ID is required'
          }
        });
      }

      // Implement badge unfavorite logic here
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: {
          code: 'BADGE_ERROR',
          message: error instanceof Error ? error.message : 'Error unfavoriting badge'
        }
      });
    }
  }
);

export default router;

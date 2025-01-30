import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types/auth';
import SubscriptionManager from '../services/subscription-manager';
import { AppError } from './error-handler.js';

const subscriptionManager = SubscriptionManager.getInstance();

interface SubscriptionDetails {
  subscriptionType: string;
  trialStartDate?: Date;
  trialEndDate?: Date;
  hasUsedTrial: boolean;
}

declare global {
  namespace Express {
    interface Request {
      subscription?: SubscriptionDetails;
    }
  }
}

// Create middleware to check subscription access
export const checkSubscription = (feature: string) => {
  return async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.user) {
        next(new AppError(401, 'Authentication required'));
        return;
      }

      const hasAccess = await subscriptionManager.hasFeatureAccess(
        req.user.id,
        feature
      );

      if (!hasAccess) {
        next(new AppError(403, 'Premium subscription required'));
        return;
      }

      // Get subscription details for the route handlers
      const details = await subscriptionManager.getSubscriptionDetails(req.user.id);
      req.subscription = details;

      next();
    } catch (err) {
      next(new AppError(500, 'Error checking premium access'));
    }
  };
};

/**
 * Middleware to require premium subscription
 * This middleware checks if the user has a premium subscription and adds subscription details to the request
 */
export const requirePremium = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authReq = req as AuthenticatedRequest;
    if (!authReq.user?.id) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required'
        }
      });
    }

    const hasAccess = await subscriptionManager.hasFeatureAccess(authReq.user.id, 'premium_access');
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'PREMIUM_REQUIRED',
          message: 'This feature requires a premium subscription'
        }
      });
    }

    // Get subscription details for the route handlers
    const details = await subscriptionManager.getSubscriptionDetails(authReq.user.id);
    req.subscription = details;

    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: {
        code: 'SUBSCRIPTION_CHECK_ERROR',
        message: error instanceof Error ? error.message : 'Error checking subscription'
      }
    });
  }
};

/**
 * Middleware to check subscription status without blocking
 * This middleware adds subscription status to the user object but doesn't block access
 */
export const checkSubscriptionStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authReq = req as AuthenticatedRequest;
    if (!authReq.user?.id) {
      return next();
    }

    const hasAccess = await subscriptionManager.hasFeatureAccess(authReq.user.id, 'premium_access');
    if (authReq.user) {
      authReq.user.hasPremiumAccess = hasAccess;
    }

    next();
  } catch (error) {
    // Log error but don't block the request
    console.error('Error checking subscription status:', error);
    next();
  }
}; 
;
;
import type { Collection } from 'mongodb';
import type { Request, Response, NextFunction } from '../types/express.js';
import { ObjectId } from 'mongodb';;;;
import { db } from '../db/index.js';;
import { AppError } from '../utils/errors.js';;
import type { AuthenticatedRequest, UserDocument } from '../types/express.js';
import type { UserSubscription } from '../types/express.js';
import { SubscriptionManager } from '../services/subscription-manager.js';;

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

// Extend UserDocument to include premium access flag
export interface UserDocumentWithPremium extends UserDocument {
  hasPremiumAccess?: boolean;
}

// Create middleware to check subscription access
export const checkSubscription = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authReq = req as AuthenticatedRequest;
    if (!authReq.user) {
      throw new AppError('Authentication required', 401);
    }

    const user = await db.getCollection<UserDocumentWithPremium>('users')
     .findOne({ _id: new ObjectId(authReq.user.id) });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    const hasAccess = await checkSubscriptionAccess(user);
    (authReq.user as UserDocumentWithPremium).hasPremiumAccess = hasAccess;

    next();
  } catch (error) {
    next(error);
  }
};

async function checkSubscriptionAccess(user: UserDocumentWithPremium): Promise<boolean> {
    // Check if user has admin role
    if (user.roles?.includes('admin')) {
        return true;
    }

    // Check for active subscription and expiry
    if (user.subscription) {
        const now = new Date();
        return user.subscription.status === 'active' && user.subscription.expiresAt > now;
    }

    return false;
}

/**
 * Middleware to require premium subscription
 * This middleware checks if the user has a premium subscription and adds subscription details to the request
 */
export const requirePremiumAccess = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) {
      throw new AppError('Authentication required', 401);
    }

    const hasAccess = await checkPremiumAccess(req.user.id);
    if (!hasAccess) {
      throw new AppError('Premium subscription required', 403);
    }

    next();
  } catch (error) {
    next(error instanceof AppError? error : new AppError('Error checking premium access', 500));
  }
};

export const checkPremiumAccess = async (userId: string): Promise<boolean> => {
  try {
    const user = await db.getCollection<UserDocumentWithPremium>('users')
     .findOne({ _id: new ObjectId(userId) }, { projection: { subscription: 1, roles: 1 } });

    if (!user) {
      return false;
    }

    // Check if user has admin role or active premium subscription
    return (
      user.roles?.includes('admin') ||
      (user.subscription?.status === 'active' && user.subscription.expiresAt > new Date())
    );
  } catch (error) {
    console.error('Error checking premium access:', error);
    return false;
  }
};

export const attachPremiumStatus = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) {
      next();
      return;
    }

    const hasAccess = await checkPremiumAccess(req.user.id);
    (req.user as UserDocumentWithPremium).hasPremiumAccess = hasAccess;
    next();
  } catch (error) {
    console.error('Error attaching premium status:', error);
    next();
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

    const hasAccess = await subscriptionManager.checkSubscriptionStatus(authReq.user.id);
    if (authReq.user) {
      (authReq.user as UserDocumentWithPremium).hasPremiumAccess = hasAccess;
    }

    next();
  } catch (error) {
    // Log error but don't block the request
    console.error('Error checking subscription status:', error);
    next();
  }
};

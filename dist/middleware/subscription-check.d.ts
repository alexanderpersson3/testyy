import type { Request, Response, NextFunction } from '../types/index.js';
import type { AuthenticatedRequest, UserDocument } from '../types/index.js';
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
export interface UserDocumentWithPremium extends UserDocument {
    hasPremiumAccess?: boolean;
}
export declare const checkSubscription: (req: Request, res: Response, next: NextFunction) => Promise<void>;
/**
 * Middleware to require premium subscription
 * This middleware checks if the user has a premium subscription and adds subscription details to the request
 */
export declare const requirePremiumAccess: (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const checkPremiumAccess: (userId: string) => Promise<boolean>;
export declare const attachPremiumStatus: (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<void>;
/**
 * Middleware to check subscription status without blocking
 * This middleware adds subscription status to the user object but doesn't block access
 */
export declare const checkSubscriptionStatus: (req: Request, res: Response, next: NextFunction) => Promise<any>;
export {};

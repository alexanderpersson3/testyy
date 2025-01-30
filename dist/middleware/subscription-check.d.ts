import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types/auth';
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
export declare const checkSubscription: (feature: string) => (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<void>;
/**
 * Middleware to require premium subscription
 * This middleware checks if the user has a premium subscription and adds subscription details to the request
 */
export declare const requirePremium: (req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
/**
 * Middleware to check subscription status without blocking
 * This middleware adds subscription status to the user object but doesn't block access
 */
export declare const checkSubscriptionStatus: (req: Request, res: Response, next: NextFunction) => Promise<void>;
export {};
//# sourceMappingURL=subscription-check.d.ts.map
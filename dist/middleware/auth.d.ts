import { Request, Response, NextFunction } from 'express';
import { AuthUser } from '../types/auth.js';
export interface AuthenticatedRequest extends Request {
    user?: AuthUser;
}
export declare function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): Response<any, Record<string, any>> | undefined;
export declare function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction): Response<any, Record<string, any>> | undefined;
export declare function requireModerator(req: AuthenticatedRequest, res: Response, next: NextFunction): Response<any, Record<string, any>> | undefined;
export declare function optionalAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void;
export declare const auth: typeof requireAuth;
export declare const authenticateToken: typeof requireAuth;
export declare const requireRole: (role: "user" | "admin" | "moderator") => (req: AuthenticatedRequest, res: Response, next: NextFunction) => Response<any, Record<string, any>> | undefined;
//# sourceMappingURL=auth.d.ts.map
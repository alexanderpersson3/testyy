import type { Request, Response, NextFunction } from '../types/index.js';
import { UserRole } from '../types/auth.js';
/**
 * Middleware to check if user has required role(s)
 */
export declare const requireRole: (requiredRole: UserRole) => (req: Request, res: Response, next: NextFunction) => Promise<void>;
/**
 * Middleware to check if user has any of the required roles
 */
export declare const requireAnyRole: (requiredRoles: UserRole[]) => (req: Request, res: Response, next: NextFunction) => Promise<void>;

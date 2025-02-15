import type { Request, Response, NextFunction } from '../types/index.js';
import { UserRole } from '../types/auth.js';
declare const auth: (req: Request, res: Response, next: NextFunction) => Promise<void>;
/**
 * Role-based authorization middleware
 */
declare const requireRole: (requiredRole: UserRole) => (req: Request, res: Response, next: NextFunction) => Promise<void>;
/**
 * Admin authorization middleware
 */
declare const isAdmin: (req: Request, res: Response, next: NextFunction) => Promise<void>;
/**
 * Authentication middleware (alias for auth)
 */
declare const authenticate: (req: Request, res: Response, next: NextFunction) => Promise<void>;
export { auth, authenticate, requireRole, isAdmin, };

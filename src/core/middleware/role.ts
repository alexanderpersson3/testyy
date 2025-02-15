import type { Request, Response, NextFunction } from '../types/express.js';
import type { AuthenticatedRequest } from '../types/express.js';
import { UserRole } from '../types/auth.js';;
import { AppError } from '../utils/error.js';;

/**
 * Middleware to check if user has required role(s)
 */
export const requireRole = (requiredRole: UserRole) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      
      // Type guard for user existence
      if (!authReq.user) {
        throw new AppError('Authentication required', 401);
      }

      // Type guard for role check
      if (authReq.user.role !== requiredRole && authReq.user.role !== UserRole.ADMIN) {
        throw new AppError('Insufficient permissions', 403);
      }

      next();
    } catch (error) {
      if (error instanceof AppError) {
        next(error);
      } else {
        next(new AppError('Role authorization failed', 500));
      }
    }
  };
};

/**
 * Middleware to check if user has any of the required roles
 */
export const requireAnyRole = (requiredRoles: UserRole[]) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      
      // Type guard for user existence
      if (!authReq.user) {
        throw new AppError('Authentication required', 401);
      }

      // Type guard for role check
      if (!requiredRoles.includes(authReq.user.role) && authReq.user.role !== UserRole.ADMIN) {
        throw new AppError('Insufficient permissions', 403);
      }

      next();
    } catch (error) {
      if (error instanceof AppError) {
        next(error);
      } else {
        next(new AppError('Role authorization failed', 500));
      }
    }
  };
};

import { Request, Response, NextFunction } from 'express';
import { verifyToken, extractTokenFromHeader } from '../utils/auth.utils.js';
import { UnauthorizedError } from '../errors/index.js';

declare global {
  namespace Express {
    interface Request {
      user?: {
        _id: string;
        role: string;
      };
    }
  }
}

/**
 * Authentication middleware that verifies JWT tokens
 */
export function authenticate(allowedRoles: string[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const token = extractTokenFromHeader(req.headers.authorization);
      if (!token) {
        throw new UnauthorizedError('No token provided');
      }

      const decoded = verifyToken(token);
      if (!allowedRoles.includes(decoded.role)) {
        throw new UnauthorizedError('Insufficient permissions');
      }

      req.user = {
        _id: decoded._id.toString(),
        role: decoded.role
      };
      next();
    } catch (error) {
      next(new UnauthorizedError('Invalid token'));
    }
  };
} 
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../../config/index.js';
import { UnauthorizedError } from '../errors/unauthorized.error.js';

declare global {
  namespace Express {
    interface Request {
      user?: {
        _id: string;
        email: string;
        role: string;
      };
    }
  }
}

/**
 * Authentication middleware
 */
export function authenticate(req: Request, res: Response, next: NextFunction): void {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      throw new UnauthorizedError('No token provided');
    }

    const decoded = jwt.verify(token, config.jwt.secret) as {
      _id: string;
      email: string;
      role: string;
    };

    req.user = decoded;
    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      next(new UnauthorizedError('Invalid token'));
    } else {
      next(error);
    }
  }
} 
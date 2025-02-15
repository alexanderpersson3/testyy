import { Request, Response, NextFunction } from 'express';
import { UnauthorizedError } from '../errors/unauthorized.error.js';

export const authorize = (allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user;

      if (!user) {
        throw new UnauthorizedError('User not authenticated');
      }

      if (!allowedRoles.includes(user.role)) {
        throw new UnauthorizedError('User not authorized for this action');
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}; 
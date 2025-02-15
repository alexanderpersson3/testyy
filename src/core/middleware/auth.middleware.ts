import { AppRequest, AppResponse, AppRequestHandler } from '../types/express';
import { UnauthorizedError } from '../errors/unauthorized.error';
import { verifyToken } from '../utils/auth.utils';

export const authenticate = (allowedRoles: string[] = []): AppRequestHandler => {
  return async (req: AppRequest, res: AppResponse, next) => {
    try {
      const token = req.headers.authorization?.split(' ')[1];
      if (!token) {
        throw new UnauthorizedError('No token provided');
      }

      const decoded = verifyToken(token);
      if (!decoded._id || !decoded.role) {
        throw new UnauthorizedError('Invalid token');
      }

      if (allowedRoles.length && !allowedRoles.includes(decoded.role)) {
        throw new UnauthorizedError('Insufficient permissions');
      }

      req.user = {
        _id: decoded._id,
        role: decoded.role
      };

      next();
    } catch (error) {
      next(error);
    }
  };
}; 
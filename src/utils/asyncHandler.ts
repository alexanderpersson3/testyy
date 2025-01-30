import { Request, Response, NextFunction } from 'express';
import { AsyncRequestHandler, AsyncMiddleware } from '../types/middleware';

export const asyncHandler = (fn: AsyncRequestHandler | AsyncMiddleware) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.user) {
      Promise.resolve((fn as AsyncRequestHandler)(req as any, res, next)).catch(next);
    } else {
      Promise.resolve((fn as AsyncMiddleware)(req, res, next)).catch(next);
    }
  };
}; 
import type { Request, Response, NextFunction } from '../types/express.js';
import type { AuthenticatedRequest } from '../types/express.js';
type AsyncHandler = (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<any>;

export const asyncHandler =
  (fn: AsyncHandler) => (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req as unknown as AuthenticatedRequest, res, next)).catch(next);
  };

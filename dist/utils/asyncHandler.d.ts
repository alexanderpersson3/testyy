import { Request, Response, NextFunction } from 'express';
import { AsyncRequestHandler, AsyncMiddleware } from '../types/middleware';
export declare const asyncHandler: (fn: AsyncRequestHandler | AsyncMiddleware) => (req: Request, res: Response, next: NextFunction) => void;
//# sourceMappingURL=asyncHandler.d.ts.map
import type { Request, Response, NextFunction } from '../types/index.js';
import type { AuthenticatedRequest } from '../types/index.js';
type AsyncHandler = (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<any>;
export declare const asyncHandler: (fn: AsyncHandler) => (req: Request, res: Response, next: NextFunction) => void;
export {};

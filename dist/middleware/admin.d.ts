import type { Request, Response, NextFunction } from '../types/index.js';
export declare const requireAdmin: (req: Request, res: Response, next: NextFunction) => Promise<void>;

import type { Request, Response, NextFunction } from '../types/index.js';
export declare const errorHandler: (err: Error, req: Request, res: Response, next: NextFunction) => void;

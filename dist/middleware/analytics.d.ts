import type { Request, Response, NextFunction } from '../types/index.js';
import { AppError } from '../utils/error.js';
export declare function trackApiMetrics(req: Request, res: Response, next: NextFunction): void;
export declare function trackErrors(error: AppError | Error, req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function trackPageView(req: Request, res: Response, next: NextFunction): void;

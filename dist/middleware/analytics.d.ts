import { Request, Response, NextFunction } from 'express';
import { AppError } from './error-handler.js';
export declare function trackApiMetrics(req: Request, res: Response, next: NextFunction): void;
export declare function trackErrors(error: AppError | Error, req: Request, res: Response, next: NextFunction): void;
export declare function trackPageView(req: Request, res: Response, next: NextFunction): void;
//# sourceMappingURL=analytics.d.ts.map
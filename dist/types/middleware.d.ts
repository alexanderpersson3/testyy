import type { Request, Response, NextFunction } from '../types/index.js';
import { z } from 'zod';
import type { ParamsDictionary } from '../types/index.js';
import type { ParsedQs } from '../types/index.js';
import type { AuthenticatedRequest } from '../types/index.js';
export interface RateLimitConfig {
    windowMs: number;
    max: number;
    message?: string;
}
export interface RateLimitMiddleware {
    api(): (req: Request, res: Response, next: NextFunction) => Promise<void>;
    auth(): (req: Request, res: Response, next: NextFunction) => Promise<void>;
}
export interface ValidationSchemas {
    body?: z.ZodSchema;
    query?: z.ZodSchema;
    params?: z.ZodSchema;
}
export type AsyncRequestHandler<P = ParamsDictionary, ResBody = any, ReqBody = any, ReqQuery = ParsedQs, Locals extends Record<string, any> = Record<string, any>> = (req: AuthenticatedRequest, res: Response<ResBody, Locals>, next: NextFunction) => Promise<any>;
export type AsyncMiddleware = (req: Request, res: Response, next: NextFunction) => Promise<any>;

import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { AuthUser } from './auth';

export interface RateLimitConfig {
  windowMs: number;
  max: number;
  message?: string;
}

export interface RateLimitMiddleware {
  api(): (req: Request, res: Response, next: NextFunction) => Promise<void>;
  auth(): (req: Request, res: Response, next: NextFunction) => Promise<void>;
}

export interface AuthenticatedRequest extends Request {
  user: AuthUser;
}

export interface ValidationSchemas {
  body?: z.ZodSchema;
  query?: z.ZodSchema;
  params?: z.ZodSchema;
}

export type AsyncRequestHandler = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => Promise<void | Response>;

export type AsyncMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => Promise<void>; 
import type { Request, Response, NextFunction } from 'express';
import type { ParamsDictionary } from 'express-serve-static-core';
import type { ParsedQs } from 'qs';
import type { ZodSchema } from 'zod';
import type { AuthenticatedRequest, RequestHandler, AuthenticatedRequestHandler } from './express.js';

// Base middleware type
export type Middleware<
  P = ParamsDictionary,
  ResBody = any,
  ReqBody = any,
  ReqQuery = ParsedQs
> = (
  req: Request<P, ResBody, ReqBody, ReqQuery>,
  res: Response<ResBody>,
  next: NextFunction
) => void | Promise<void>;

// Authentication middleware type
export type AuthMiddleware<
  P = ParamsDictionary,
  ResBody = any,
  ReqBody = any,
  ReqQuery = ParsedQs
> = (
  req: Request<P, ResBody, ReqBody, ReqQuery>,
  res: Response<ResBody>,
  next: NextFunction
) => Promise<void>;

// Request handler wrapper type
export type RequestHandlerWrapper<
  P = ParamsDictionary,
  ResBody = any,
  ReqBody = any,
  ReqQuery = ParsedQs
> = (
  handler: RequestHandler<P, ResBody, ReqBody, ReqQuery>
) => RequestHandler<P, ResBody, ReqBody, ReqQuery>;

// Authenticated request handler wrapper type
export type AuthenticatedRequestHandlerWrapper<
  P = ParamsDictionary,
  ResBody = any,
  ReqBody = any,
  ReqQuery = ParsedQs
> = (
  handler: AuthenticatedRequestHandler<P, ResBody, ReqBody, ReqQuery>
) => RequestHandler<P, ResBody, ReqBody, ReqQuery>;

// Validation middleware options
export interface ValidationOptions {
  stripUnknown?: boolean;
  abortEarly?: boolean;
}

// Validation middleware factory type
export type ValidationMiddlewareFactory = <T>(
  schema: ZodSchema<T>,
  options?: ValidationOptions
) => Middleware<ParamsDictionary, any, T>;

// Cache middleware options
export interface CacheOptions {
  ttl: number;
  key?: string | ((req: Request) => string);
  condition?: (req: Request) => boolean;
}

// Cache middleware factory type
export type CacheMiddlewareFactory = (
  options: CacheOptions
) => Middleware;

// Error handling middleware type
export type ErrorMiddleware = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => void | Promise<void>;

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
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
}

export type AsyncRequestHandler<
  P = ParamsDictionary,
  ResBody = any,
  ReqBody = any,
  ReqQuery = ParsedQs,
  Locals extends Record<string, any> = Record<string, any>,
> = (req: AuthenticatedRequest, res: Response<ResBody, Locals>, next: NextFunction) => Promise<any>;

export type AsyncMiddleware = (req: Request, res: Response, next: NextFunction) => Promise<any>;

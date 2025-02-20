import type { Request as ExpressRequest, Response as ExpressResponse, NextFunction as ExpressNextFunction } from 'express';
import type { ParamsDictionary } from 'express-serve-static-core';
import type { ParsedQs } from 'qs';
import type { Types } from 'mongoose';
import type { ZodSchema } from 'zod';
import type { ErrorContext } from './base.types';
import type { ApiResponse, PaginatedResponse } from './base.types';
import type { AuthUser as BaseAuthUser, JwtUser } from './auth.types';

// Re-export auth types
export type { BaseAuthUser, JwtUser };

// User type for authenticated requests
export interface AuthUser {
  id: Types.ObjectId;
  email: string;
  role: string;
  permissions: string[];
  isVerified: boolean;
  requires2FA?: boolean;
}

// Base request interface with type safety
export interface Request<
  P = ParamsDictionary,
  ResBody = unknown,
  ReqBody = unknown,
  ReqQuery = ParsedQs,
  Locals extends Record<string, unknown> = Record<string, unknown>
> extends ExpressRequest<P, ResBody, ReqBody, ReqQuery, Locals> {
  user?: AuthUser;
  path: string;
  method: string;
  headers: Record<string, string | string[] | undefined>;
  query: ReqQuery;
  body: ReqBody;
  params: P;
  ip: string;
  protocol: string;
  secure: boolean;
  originalUrl: string;
  baseUrl: string;
  // Performance monitoring
  performance?: {
    startTime: number;
    endTime?: number;
    duration?: number;
  };
  // Rate limiting
  rateLimit?: {
    limit: number;
    current: number;
    remaining: number;
    resetTime: Date;
  };
}

// Authenticated request with guaranteed user
export interface AuthenticatedRequest<
  P = ParamsDictionary,
  ResBody = unknown,
  ReqBody = unknown,
  ReqQuery = ParsedQs,
  Locals extends Record<string, unknown> = Record<string, unknown>
> extends Request<P, ResBody, ReqBody, ReqQuery, Locals> {
  user: AuthUser;
}

// Response with type safety
export interface Response<
  ResBody = unknown,
  Locals extends Record<string, unknown> = Record<string, unknown>
> extends ExpressResponse<ResBody, Locals> {
  // Type-safe send methods
  json<T extends ResBody>(body: T): this;
  send<T extends ResBody>(body: T): this;
  
  // API response helpers
  success<T>(data: T): Response<ApiResponse<T>>;
  error(error: ErrorContext): Response<ApiResponse<never>>;
  paginated<T>(response: PaginatedResponse<T>): Response<ApiResponse<PaginatedResponse<T>>>;
}

// Type-safe next function
export type NextFunction = ExpressNextFunction;

// Base middleware type
export type Middleware<
  P = ParamsDictionary,
  ResBody = unknown,
  ReqBody = unknown,
  ReqQuery = ParsedQs,
  Locals extends Record<string, unknown> = Record<string, unknown>
> = (
  req: Request<P, ResBody, ReqBody, ReqQuery, Locals>,
  res: Response<ResBody, Locals>,
  next: NextFunction
) => void | Promise<void>;

// Authenticated middleware type
export type AuthenticatedMiddleware<
  P = ParamsDictionary,
  ResBody = unknown,
  ReqBody = unknown,
  ReqQuery = ParsedQs,
  Locals extends Record<string, unknown> = Record<string, unknown>
> = (
  req: AuthenticatedRequest<P, ResBody, ReqBody, ReqQuery, Locals>,
  res: Response<ResBody, Locals>,
  next: NextFunction
) => void | Promise<void>;

// Error middleware type
export type ErrorMiddleware = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => void | Promise<void>;

// Validation middleware type
export type ValidationMiddleware<T> = (
  schema: ZodSchema<T>
) => Middleware<ParamsDictionary, unknown, T>;

// Route handler types
export type RouteHandler<
  P = ParamsDictionary,
  ResBody = unknown,
  ReqBody = unknown,
  ReqQuery = ParsedQs,
  Locals extends Record<string, unknown> = Record<string, unknown>
> = (
  req: Request<P, ResBody, ReqBody, ReqQuery, Locals>,
  res: Response<ResBody, Locals>,
  next: NextFunction
) => Promise<void> | void;

// Authenticated route handler
export type AuthenticatedRouteHandler<
  P = ParamsDictionary,
  ResBody = unknown,
  ReqBody = unknown,
  ReqQuery = ParsedQs,
  Locals extends Record<string, unknown> = Record<string, unknown>
> = (
  req: AuthenticatedRequest<P, ResBody, ReqBody, ReqQuery, Locals>,
  res: Response<ResBody, Locals>,
  next: NextFunction
) => Promise<void> | void;

// Utility types
export type TypedRequest<T> = Request<ParamsDictionary, unknown, T>;
export type TypedResponse<T> = Response<T>;

// Extend express Request
declare global {
  namespace Express {
    interface Request {
      user?: JwtUser;
      performance?: {
        startTime: number;
        endTime?: number;
        duration?: number;
      };
      rateLimit?: {
        limit: number;
        current: number;
        remaining: number;
        resetTime: Date;
      };
    }

    interface Response<ResBody = unknown> {
      success<T>(data: T): Response<ApiResponse<T>>;
      error(error: ErrorContext): Response<ApiResponse<never>>;
      paginated<T>(response: PaginatedResponse<T>): Response<ApiResponse<PaginatedResponse<T>>>;
    }
  }
}

// Export everything from a single source
export {
  Request as ExpressRequest,
  Response as ExpressResponse,
  NextFunction as ExpressNextFunction,
  AuthUser,
  Middleware,
  AuthenticatedMiddleware,
  ErrorMiddleware,
  ValidationMiddleware,
  RouteHandler,
  AuthenticatedRouteHandler,
  TypedRequest,
  TypedResponse
}; 
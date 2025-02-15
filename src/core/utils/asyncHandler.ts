import type { Request, Response, NextFunction } from 'express';
import type { ParamsDictionary } from 'express-serve-static-core';
import type { ParsedQs } from 'qs';
import type { 
  RequestHandler, 
  AuthenticatedRequestHandler,
  AuthenticatedRequest 
} from '../types/express.js';

// Generic async handler that works with both regular and authenticated requests
export function asyncHandler<
  P = ParamsDictionary,
  ResBody = any,
  ReqBody = any,
  ReqQuery = ParsedQs
>(
  handler: (
    req: Request<P, ResBody, ReqBody, ReqQuery> | AuthenticatedRequest<P, ResBody, ReqBody, ReqQuery>,
    res: Response<ResBody>,
    next: NextFunction
  ) => Promise<void | Response<ResBody>>
): RequestHandler<P, ResBody, ReqBody, ReqQuery> {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

// Specific handler for authenticated requests
export function asyncAuthHandler<
  P = ParamsDictionary,
  ResBody = any,
  ReqBody = any,
  ReqQuery = ParsedQs
>(
  handler: (
    req: AuthenticatedRequest<P, ResBody, ReqBody, ReqQuery>,
    res: Response<ResBody>,
    next: NextFunction
  ) => Promise<void | Response<ResBody>>
): RequestHandler<P, ResBody, ReqBody, ReqQuery> {
  return (req, res, next) => {
    Promise.resolve(handler(req as AuthenticatedRequest<P, ResBody, ReqBody, ReqQuery>, res, next)).catch(next);
  };
}

import { Request, Response, NextFunction, RequestHandler } from 'express';
import { ParamsDictionary } from 'express-serve-static-core';
import { ParsedQs } from 'qs';
import { AppError } from './error-handler.js';

/**
 * Type definition for async request handlers that properly handles Express's type system limitations
 */
export type AsyncRequestHandler<
  P = ParamsDictionary,
  ResBody = any,
  ReqBody = any,
  ReqQuery = ParsedQs,
  Locals extends Record<string, any> = Record<string, any>
> = (
  req: Request<P, ResBody, ReqBody, ReqQuery>,
  res: Response<ResBody, Locals>,
  next: NextFunction
) => Promise<any>;

/**
 * Wraps an async request handler to properly handle Promise rejections
 * and provide correct TypeScript types
 */
export const asyncHandler = <
  P = ParamsDictionary,
  ResBody = any,
  ReqBody = any,
  ReqQuery = ParsedQs,
  Locals extends Record<string, any> = Record<string, any>
>(
  fn: AsyncRequestHandler<P, ResBody, ReqBody, ReqQuery, Locals>
): RequestHandler<P, ResBody, ReqBody, ReqQuery, Locals> => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next))
      .catch(err => {
        // Convert unknown errors to AppError
        if (!(err instanceof AppError)) {
          console.error('Unhandled error in route handler:', err);
          err = new AppError(
            'An unexpected error occurred',
            500
          );
        }
        next(err);
      });
  };
}; 
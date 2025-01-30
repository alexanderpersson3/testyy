import { Request, Response, NextFunction, RequestHandler } from 'express';
import { ParamsDictionary } from 'express-serve-static-core';
import { ParsedQs } from 'qs';
/**
 * Type definition for async request handlers that properly handles Express's type system limitations
 */
export type AsyncRequestHandler<P = ParamsDictionary, ResBody = any, ReqBody = any, ReqQuery = ParsedQs, Locals extends Record<string, any> = Record<string, any>> = (req: Request<P, ResBody, ReqBody, ReqQuery>, res: Response<ResBody, Locals>, next: NextFunction) => Promise<any>;
/**
 * Wraps an async request handler to properly handle Promise rejections
 * and provide correct TypeScript types
 */
export declare const asyncHandler: <P = ParamsDictionary, ResBody = any, ReqBody = any, ReqQuery = ParsedQs, Locals extends Record<string, any> = Record<string, any>>(fn: AsyncRequestHandler<P, ResBody, ReqBody, ReqQuery, Locals>) => RequestHandler<P, ResBody, ReqBody, ReqQuery, Locals>;
//# sourceMappingURL=async-handler.d.ts.map
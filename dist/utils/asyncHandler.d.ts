import type { Request, Response, NextFunction, RequestHandler } from '../types/index.js';
import type { AuthenticatedTypedRequest, TypedResponse, AuthenticatedRequestHandler } from '../types/index.js';
import type { ParamsDictionary } from '../types/index.js';
import type { ParsedQs } from '../types/index.js';
type AsyncHandler<P extends ParamsDictionary = ParamsDictionary, ResBody = any, ReqBody = any, ReqQuery extends ParsedQs = ParsedQs, Locals extends Record<string, any> = Record<string, any>> = (req: Request<P, ResBody, ReqBody, ReqQuery, Locals>, res: Response<ResBody, Locals>, next: NextFunction) => Promise<void | Response<ResBody, Locals>>;
type AsyncAuthenticatedHandler<P extends ParamsDictionary = ParamsDictionary, ResBody = any, ReqBody = any, ReqQuery extends ParsedQs = ParsedQs, Locals extends Record<string, any> = Record<string, any>> = (req: AuthenticatedTypedRequest<P, ReqBody, ReqQuery>, res: TypedResponse<ResBody>, next: NextFunction) => Promise<void | Response<ResBody, Locals>>;
export declare function asyncHandler<P extends ParamsDictionary = ParamsDictionary, ResBody = any, ReqBody = any, ReqQuery extends ParsedQs = ParsedQs, Locals extends Record<string, any> = Record<string, any>>(fn: AsyncHandler<P, ResBody, ReqBody, ReqQuery, Locals>): RequestHandler<P, ResBody, ReqBody, ReqQuery, Locals>;
export declare function asyncAuthHandler<P extends ParamsDictionary = ParamsDictionary, ResBody = any, ReqBody = any, ReqQuery extends ParsedQs = ParsedQs, Locals extends Record<string, any> = Record<string, any>>(fn: AsyncAuthenticatedHandler<P, ResBody, ReqBody, ReqQuery, Locals>): AuthenticatedRequestHandler<P, ResBody, ReqBody, ReqQuery>;
export {};

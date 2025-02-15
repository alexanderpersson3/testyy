import type { Request, Response, NextFunction, RequestHandler } from '../types/express.js';
import type { ParamsDictionary } from '../types/express.js';
import type { ParsedQs } from '../types/express.js';
import type { UserDocument } from '../types/express.js';
import type { MongoDocument } from '../types/express.js';
/**
 * Base interface for typed requests
 */
export interface TypedRequest<
  P = ParamsDictionary,
  ResBody = any,
  ReqBody = any,
  ReqQuery = ParsedQs,
> extends Request<P, ResBody, ReqBody, ReqQuery> {}

/**
 * Interface for requests that require authentication
 */
export interface AuthenticatedRequest<
  P = ParamsDictionary,
  ResBody = any,
  ReqBody = any,
  ReqQuery = ParsedQs,
> extends TypedRequest<P, ResBody, ReqBody, ReqQuery> {
  user: UserDocument;
}

/**
 * Interface for requests that include file uploads
 */
export interface FileRequest<
  P = ParamsDictionary,
  ResBody = any,
  ReqBody = any,
  ReqQuery = ParsedQs,
> extends TypedRequest<P, ResBody, ReqBody, ReqQuery> {
  file?: Express.Multer.File;
  files?: Express.Multer.File[];
}

/**
 * Interface for authenticated requests with file uploads
 */
export interface AuthenticatedFileRequest<
  P = ParamsDictionary,
  ResBody = any,
  ReqBody = any,
  ReqQuery = ParsedQs,
> extends AuthenticatedRequest<P, ResBody, ReqBody, ReqQuery> {
  file?: Express.Multer.File;
  files?: Express.Multer.File[];
}

/**
 * Type for route handler functions
 */
export type RouteHandler<
  P = ParamsDictionary,
  ResBody = any,
  ReqBody = any,
  ReqQuery = ParsedQs,
> = (
  req: TypedRequest<P, ResBody, ReqBody, ReqQuery>,
  res: Response<ResBody>,
  next: NextFunction
) => Promise<void | Response<ResBody>>;

/**
 * Type for authenticated route handler functions
 */
export type AuthenticatedRouteHandler<
  P = ParamsDictionary,
  ResBody = any,
  ReqBody = any,
  ReqQuery = ParsedQs,
> = (
  req: AuthenticatedRequest<P, ResBody, ReqBody, ReqQuery>,
  res: Response<ResBody>,
  next: NextFunction
) => Promise<void | Response<ResBody>>;

/**
 * Type for file upload route handler functions
 */
export type FileRouteHandler<
  P = ParamsDictionary,
  ResBody = any,
  ReqBody = any,
  ReqQuery = ParsedQs,
> = (
  req: FileRequest<P, ResBody, ReqBody, ReqQuery>,
  res: Response<ResBody>,
  next: NextFunction
) => Promise<void | Response<ResBody>>;

/**
 * Type for authenticated file upload route handler functions
 */
export type AuthenticatedFileRouteHandler<
  P = ParamsDictionary,
  ResBody = any,
  ReqBody = any,
  ReqQuery = ParsedQs,
> = (
  req: AuthenticatedFileRequest<P, ResBody, ReqBody, ReqQuery>,
  res: Response<ResBody>,
  next: NextFunction
) => Promise<void | Response<ResBody>>;

/**
 * Helper type for route parameters
 */
export type RouteParams<T extends string> = {
  [K in T]: string;
} & ParamsDictionary;

/**
 * Helper type for response bodies that include a document
 */
export type DocumentResponse<T extends MongoDocument> = {
  data: T;
  message?: string;
};

/**
 * Helper type for paginated response bodies
 */
export type PaginatedResponse<T extends MongoDocument> = {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

/**
 * Helper type for error responses
 */
export type ErrorResponse = {
  error: {
    code: string;
    message: string;
    details?: any;
  };
};

/**
 * Helper type for success responses
 */
export type SuccessResponse<T = void> = {
  success: true;
  data?: T;
  message?: string;
}; 
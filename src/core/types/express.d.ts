import type { Request as ExpressRequest, Response as ExpressResponse, NextFunction as ExpressNextFunction } from 'express';
import type { ParamsDictionary } from 'express-serve-static-core';
import type { ParsedQs } from 'qs';

declare global {
  namespace Express {
    // Extend Express Request
    interface Request {
      user?: any;
      session?: any;
      files?: any;
      body: any;
      query: ParsedQs;
      alerts?: {
        service: import('../monitoring/alerts.service').AlertsService;
        getActive: () => Array<{
          id: string;
          ruleId: string;
          message: string;
          severity: 'info' | 'warning' | 'error' | 'critical';
          metric: string;
          value: number;
          threshold: number;
          timestamp: number;
          tags?: Record<string, string>;
        }>;
        getRules: () => Array<{
          id: string;
          name: string;
          description: string;
          metric: string;
          condition: 'gt' | 'lt' | 'eq';
          threshold: number;
          duration: number;
          cooldown: number;
          tags?: Record<string, string>;
          enabled: boolean;
        }>;
      };
    }

    // Extend Express Response
    interface Response {
      locals: {
        user?: any;
        [key: string]: any;
      };
    }
  }
}

// Base interfaces for type-safe requests
export interface BaseRequest extends ExpressRequest {
  body: any;
  query: ParsedQs;
  params: ParamsDictionary;
}

export interface TypedRequestParams<P extends ParamsDictionary> extends BaseRequest {
  params: P;
}

export interface TypedRequestBody<B> extends BaseRequest {
  body: B;
}

export interface TypedRequestQuery<Q extends ParsedQs> extends BaseRequest {
  query: Q;
}

export interface TypedRequest<
  P extends ParamsDictionary = ParamsDictionary,
  B = any,
  Q extends ParsedQs = ParsedQs
> extends BaseRequest {
  params: P;
  body: B;
  query: Q;
}

export interface TypedResponse<ResBody = any> extends ExpressResponse {
  json(data: ResBody): this;
  locals: {
    user?: any;
    [key: string]: any;
  };
}

export interface AuthenticatedRequest extends BaseRequest {
  user: any;
}

export interface AuthenticatedTypedRequest<
  P extends ParamsDictionary = ParamsDictionary,
  B = any,
  Q extends ParsedQs = ParsedQs
> extends TypedRequest<P, B, Q> {
  user: any;
}

export type RequestHandler<
  P extends ParamsDictionary = ParamsDictionary,
  ResBody = any,
  ReqBody = any,
  ReqQuery extends ParsedQs = ParsedQs
> = (
  req: TypedRequest<P, ReqBody, ReqQuery>,
  res: TypedResponse<ResBody>,
  next: ExpressNextFunction
) => void | Promise<void>;

export type AuthenticatedRequestHandler<
  P extends ParamsDictionary = ParamsDictionary,
  ResBody = any,
  ReqBody = any,
  ReqQuery extends ParsedQs = ParsedQs
> = (
  req: AuthenticatedTypedRequest<P, ReqBody, ReqQuery>,
  res: TypedResponse<ResBody>,
  next: ExpressNextFunction
) => void | Promise<void>;

export { ExpressRequest as Request, ExpressResponse as Response, ExpressNextFunction as NextFunction };

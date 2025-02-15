import { Request as ExpressRequest, Response as ExpressResponse } from 'express';
import { ParamsDictionary } from 'express-serve-static-core';
import { ParsedQs } from 'qs';

export interface Request<
  P = ParamsDictionary,
  ResBody = any,
  ReqBody = any,
  ReqQuery = ParsedQs,
> extends ExpressRequest<P, ResBody, ReqBody, ReqQuery> {
  user?: {
    _id: string;
    role: string;
  };
}

export interface Response<T = any> extends ExpressResponse<T> {}

export interface HttpError extends Error {
  status?: number;
  code?: string;
  details?: unknown;
}

export interface HttpResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: {
    timestamp: Date;
    duration?: number;
  };
} 
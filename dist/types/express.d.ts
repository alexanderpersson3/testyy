import type { Request as ExpressRequest, Response as ExpressResponse, NextFunction as ExpressNextFunction, RequestHandler as ExpressRequestHandler } from '../types/index.js';
import type { UserDocument } from '../types/index.js';
import type { ParamsDictionary } from '../types/index.js';
import type { ParsedQs } from '../types/index.js';
import express from 'express';
export declare const Router: typeof express.Router;
export interface BaseRequest extends ExpressRequest {
    user?: UserDocument;
}
export interface BaseResponse extends ExpressResponse {
}
export interface AuthenticatedTypedRequest<P extends ParamsDictionary = ParamsDictionary, B = any, Q extends ParsedQs = ParsedQs> extends BaseRequest {
    user: UserDocument;
    params: P;
    body: B;
    query: Q;
}
export interface TypedResponse<ResBody = any> extends Omit<BaseResponse, 'json'> {
    json(body: ResBody): this;
}
export interface AuthenticatedRequest<P = ParamsDictionary, ResBody = any, ReqBody = any, ReqQuery = ParsedQs> extends ExpressRequest<P, ResBody, ReqBody, ReqQuery> {
    user: UserDocument;
}
export interface TypedRequest<P = ParamsDictionary, ResBody = any, ReqBody = any, ReqQuery = ParsedQs> extends ExpressRequest<P, ResBody, ReqBody, ReqQuery> {
}
export interface AuthenticatedRequestHandler<P = ParamsDictionary, ResBody = any, ReqBody = any, ReqQuery = ParsedQs> extends ExpressRequestHandler<P, ResBody, ReqBody, ReqQuery> {
    (req: AuthenticatedRequest<P, ResBody, ReqBody, ReqQuery>, res: ExpressResponse<ResBody>, next: ExpressNextFunction): void | Promise<void>;
}
export interface TypedRequestHandler<P = ParamsDictionary, ResBody = any, ReqBody = any, ReqQuery = ParsedQs> extends ExpressRequestHandler<P, ResBody, ReqBody, ReqQuery> {
    (req: TypedRequest<P, ResBody, ReqBody, ReqQuery>, res: ExpressResponse<ResBody>, next: ExpressNextFunction): void | Promise<void>;
}
export interface TypedRequestBody<T> extends ExpressRequest {
    body: T;
}
export interface TypedRequestQuery<T extends ParsedQs> extends ExpressRequest {
    query: T;
}
export interface TypedRequestParams<T extends ParamsDictionary> extends ExpressRequest {
    params: T;
}
export type AsyncRequestHandler<P = ParamsDictionary, ResBody = any, ReqBody = any, ReqQuery = ParsedQs> = (req: ExpressRequest<P, ResBody, ReqBody, ReqQuery>, res: ExpressResponse<ResBody>, next: ExpressNextFunction) => Promise<void | ExpressResponse<ResBody>>;
export type AsyncAuthenticatedRequestHandler<P = ParamsDictionary, ResBody = any, ReqBody = any, ReqQuery = ParsedQs> = (req: AuthenticatedRequest<P, ResBody, ReqBody, ReqQuery>, res: ExpressResponse<ResBody>, next: ExpressNextFunction) => Promise<void | ExpressResponse<ResBody>>;

import type { Router, type RequestHandler } from 'express';
import type { ValidationChain } from '../types/index.js';
export declare class TypedRouter {
    private router;
    constructor();
    get(path: string, ...handlers: Array<RequestHandler | ValidationChain>): this;
    post(path: string, ...handlers: Array<RequestHandler | ValidationChain>): this;
    put(path: string, ...handlers: Array<RequestHandler | ValidationChain>): this;
    delete(path: string, ...handlers: Array<RequestHandler | ValidationChain>): this;
    patch(path: string, ...handlers: Array<RequestHandler | ValidationChain>): this;
    use(...handlers: RequestHandler[]): this;
    use(path: string, ...handlers: RequestHandler[]): this;
    getRouter(): Router;
}
export default TypedRouter;

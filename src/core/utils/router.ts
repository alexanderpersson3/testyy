import { Router } from '../types/express.d.ts'
import { RequestHandler, ValidationChain, ParamsDictionary } from '@/core/types/express'

import { Router } from '../types/express.d.ts';;
import { AuthRouter } from '@/types/express';

export class TypedRouter {
  private router: Router;

  constructor() {
    this.router = Router();
  }

  public get(path: string, ...handlers: Array<RequestHandler | ValidationChain>): this {
    handlers.forEach(handler => {
      if ('field' in handler) {
        // It's a ValidationChain
        this.router.get(path, handler as any);
      } else {
        // It's a RequestHandler
        this.router.get(path, handler);
      }
    });
    return this;
  }

  public post(path: string, ...handlers: Array<RequestHandler | ValidationChain>): this {
    handlers.forEach(handler => {
      if ('field' in handler) {
        // It's a ValidationChain
        this.router.post(path, handler as any);
      } else {
        // It's a RequestHandler
        this.router.post(path, handler);
      }
    });
    return this;
  }

  public put(path: string, ...handlers: Array<RequestHandler | ValidationChain>): this {
    handlers.forEach(handler => {
      if ('field' in handler) {
        // It's a ValidationChain
        this.router.put(path, handler as any);
      } else {
        // It's a RequestHandler
        this.router.put(path, handler);
      }
    });
    return this;
  }

  public delete(path: string, ...handlers: Array<RequestHandler | ValidationChain>): this {
    handlers.forEach(handler => {
      if ('field' in handler) {
        // It's a ValidationChain
        this.router.delete(path, handler as any);
      } else {
        // It's a RequestHandler
        this.router.delete(path, handler);
      }
    });
    return this;
  }

  public patch(path: string, ...handlers: Array<RequestHandler | ValidationChain>): this {
    handlers.forEach(handler => {
      if ('field' in handler) {
        // It's a ValidationChain
        this.router.patch(path, handler as any);
      } else {
        // It's a RequestHandler
        this.router.patch(path, handler);
      }
    });
    return this;
  }

  public use(...handlers: RequestHandler[]): this;
  public use(path: string, ...handlers: RequestHandler[]): this;
  public use(pathOrHandler: string | RequestHandler, ...handlers: RequestHandler[]): this {
    if (typeof pathOrHandler === 'string') {
      this.router.use(pathOrHandler, ...handlers);
    } else {
      this.router.use(pathOrHandler, ...handlers);
    }
    return this;
  }

  public getRouter(): Router {
    return this.router;
  }
}

export default TypedRouter;

/**
 * Creates a new router instance with proper type support for authenticated handlers
 * @returns A router instance that supports both regular and authenticated handlers
 */
export const createAuthRouter = (): AuthRouter => {
  const router = Router();
  return router as unknown as AuthRouter;
}; 
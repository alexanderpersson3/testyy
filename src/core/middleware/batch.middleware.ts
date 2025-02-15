import { Request, Response, NextFunction } from 'express';
import { Logger } from '../logger/logger';

interface BatchRequest {
  method: string;
  path: string;
  body?: any;
  headers?: Record<string, string>;
}

interface BatchResponse {
  status: number;
  body: any;
  headers?: Record<string, string>;
}

export class BatchMiddleware {
  private readonly logger = new Logger('BatchMiddleware');
  private readonly app: any; // Express application

  constructor(app: any) {
    this.app = app;
  }

  handle() {
    return async (req: Request, res: Response, next: NextFunction) => {
      if (!Array.isArray(req.body)) {
        return next();
      }

      try {
        const requests: BatchRequest[] = req.body;
        if (requests.length > 10) {
          return res.status(400).json({
            error: 'Batch size cannot exceed 10 requests'
          });
        }

        const responses: BatchResponse[] = await Promise.all(
          requests.map(request => this.processRequest(request, req))
        );

        res.json(responses);
      } catch (err) {
        this.logger.error('Batch processing error', { 
          error: err instanceof Error ? err : String(err)
        });
        next(err);
      }
    };
  }

  private async processRequest(
    batchReq: BatchRequest,
    originalReq: Request
  ): Promise<BatchResponse> {
    return new Promise((resolve) => {
      // Create mock request and response objects
      const req = this.createMockRequest(batchReq, originalReq);
      const res = this.createMockResponse(resolve);

      // Route the request through the Express application
      this.app._router.handle(req, res, (err: Error) => {
        if (err) {
          resolve({
            status: 500,
            body: {
              error: 'Internal Server Error',
              message: err.message
            }
          });
        }
      });
    });
  }

  private createMockRequest(batchReq: BatchRequest, originalReq: Request): Request {
    const req = Object.create(originalReq);
    
    // Copy original request properties
    req.method = batchReq.method;
    req.path = batchReq.path;
    req.url = batchReq.path;
    req.body = batchReq.body;
    req.headers = {
      ...originalReq.headers,
      ...batchReq.headers
    };

    // Copy authentication and user information
    req.user = originalReq.user;
    req.isAuthenticated = originalReq.isAuthenticated;
    req.session = originalReq.session;

    return req;
  }

  private createMockResponse(resolve: (response: BatchResponse) => void): Response {
    const res = {} as Response;
    const headers: Record<string, string> = {};

    // Mock response methods
    res.status = function(code: number) {
      this.statusCode = code;
      return this;
    };

    res.set = function(name: string, value: string) {
      headers[name] = value;
      return this;
    };

    res.json = function(body: any) {
      resolve({
        status: this.statusCode || 200,
        body,
        headers
      });
    };

    res.send = function(body: any) {
      resolve({
        status: this.statusCode || 200,
        body,
        headers
      });
    };

    return res;
  }
} 
import { Request, Response, NextFunction } from 'express';
import { PerformanceService } from './performance.service';
import { Logger } from '../logger/logger';

export class PerformanceMiddleware {
  private readonly performanceService: PerformanceService;
  private readonly logger: Logger;

  constructor() {
    this.performanceService = PerformanceService.getInstance();
    this.logger = new Logger('PerformanceMiddleware');
  }

  handle() {
    return (req: Request, res: Response, next: NextFunction) => {
      const startTime = Date.now();
      const traceId = this.performanceService.startTrace('http_request', {
        method: req.method,
        path: req.path,
        query: JSON.stringify(req.query),
        userAgent: req.get('user-agent') || 'unknown'
      });

      // Track response size and completion
      let responseSize = 0;
      const chunks: Buffer[] = [];
      const self = this;

      // Create a transform stream to track response size
      const originalWrite = res.write;
      const originalEnd = res.end;

      // Extend response write method
      const writeResponse = function(this: Response, chunk: any, encoding?: BufferEncoding, callback?: (error: Error | null | undefined) => void) {
        if (chunk) {
          const buffer = Buffer.isBuffer(chunk) 
            ? chunk 
            : Buffer.from(chunk, typeof chunk === 'string' ? (encoding || 'utf8') : 'utf8');
          responseSize += buffer.length;
          chunks.push(buffer);
        }
        return originalWrite.call(this, chunk, encoding || 'utf8', callback);
      };

      // Extend response end method
      const endResponse = function(this: Response, chunk?: any, encoding?: BufferEncoding | (() => void), callback?: () => void) {
        if (chunk) {
          const buffer = Buffer.isBuffer(chunk) 
            ? chunk 
            : Buffer.from(chunk, typeof chunk === 'string' && typeof encoding === 'string' ? encoding : 'utf8');
          responseSize += buffer.length;
          chunks.push(buffer);
        }

        const endTime = Date.now();
        const duration = endTime - startTime;

        // Record metrics
        self.performanceService.recordMetric('http_request_duration', duration, {
          method: req.method,
          path: req.path,
          status: res.statusCode.toString()
        });

        self.performanceService.recordMetric('http_response_size', responseSize, {
          method: req.method,
          path: req.path
        });

        // End trace
        self.performanceService.endTrace(traceId, res.statusCode >= 400 ? new Error(`HTTP ${res.statusCode}`) : undefined);

        // Log request details
        self.logger.debug('Request completed', {
          method: req.method,
          path: req.path,
          duration,
          status: res.statusCode,
          size: responseSize
        });

        // Handle callback overloading
        if (typeof encoding === 'function') {
          callback = encoding;
          encoding = undefined;
        }
        return originalEnd.call(this, chunk, encoding || 'utf8', callback);
      };

      // Apply the response method extensions
      Object.defineProperty(res, 'write', {
        value: writeResponse,
        writable: true,
        configurable: true
      });

      Object.defineProperty(res, 'end', {
        value: endResponse,
        writable: true,
        configurable: true
      });

      // Track database operations
      const dbSpanId = this.performanceService.startSpan(traceId, 'database_operations');
      let dbOperations = 0;

      const dbOperationComplete = () => {
        dbOperations++;
        this.performanceService.recordMetric('database_operations', dbOperations, {
          method: req.method,
          path: req.path
        });
      };

      // Listen for database operation events
      req.on('database:operation', dbOperationComplete);

      // Cleanup
      res.on('finish', () => {
        this.performanceService.endSpan(dbSpanId);
        req.removeListener('database:operation', dbOperationComplete);
      });

      // Error handling
      const errorHandler = (error: Error) => {
        this.performanceService.recordMetric('errors', 1, {
          method: req.method,
          path: req.path,
          type: error.name,
          message: error.message
        });
      };

      req.on('error', errorHandler);
      res.on('error', errorHandler);

      // Cleanup error handlers
      res.on('finish', () => {
        req.removeListener('error', errorHandler);
        res.removeListener('error', errorHandler);
      });

      next();
    };
  }
} 
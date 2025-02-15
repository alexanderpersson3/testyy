import compression from 'compression';
import { Request, Response, NextFunction } from 'express';
import { Logger } from '../logger/logger';

interface CompressionOptions {
  level?: number;
  threshold?: number;
  filter?: (req: Request, res: Response) => boolean;
}

export class CompressionMiddleware {
  private readonly logger = new Logger('CompressionMiddleware');
  private readonly options: CompressionOptions;

  constructor(options: CompressionOptions = {}) {
    this.options = {
      level: options.level || 6,
      threshold: options.threshold || 1024,
      filter: options.filter || this.defaultFilter
    };
  }

  handle() {
    const middleware = compression({
      level: this.options.level,
      threshold: this.options.threshold,
      filter: this.shouldCompress.bind(this)
    });

    return (req: Request, res: Response, next: NextFunction) => {
      try {
        // Track response size before and after compression
        const originalSend = res.send;
        const self = this;

        res.send = function(body: any) {
          const beforeSize = self.calculateSize(body);
          const result = originalSend.call(res, body);
          
          // Log compression metrics
          if (res.getHeader('Content-Encoding') === 'gzip') {
            const afterSize = parseInt(res.getHeader('Content-Length') as string, 10);
            const ratio = ((beforeSize - afterSize) / beforeSize * 100).toFixed(2);
            
            self.logger.debug('Response compressed', {
              path: req.path,
              beforeSize,
              afterSize,
              ratio: `${ratio}%`
            });
          }
          
          return result;
        };

        middleware(req, res, next);
      } catch (err) {
        this.logger.error('Compression error', {
          error: err instanceof Error ? err : String(err),
          path: req.path
        });
        next();
      }
    };
  }

  private shouldCompress(req: Request, res: Response): boolean {
    if (this.options.filter && !this.options.filter(req, res)) {
      return false;
    }

    return this.defaultFilter(req, res);
  }

  private defaultFilter(req: Request, res: Response): boolean {
    // Skip compression for small responses or streaming responses
    if (res.getHeader('Content-Length') && 
        parseInt(res.getHeader('Content-Length') as string, 10) < (this.options.threshold || 1024)) {
      return false;
    }

    // Skip compression for already compressed responses
    const contentEncoding = res.getHeader('Content-Encoding');
    if (contentEncoding && contentEncoding !== 'identity') {
      return false;
    }

    // Skip compression for certain content types
    const contentType = res.getHeader('Content-Type');
    if (typeof contentType === 'string') {
      if (contentType.includes('image/') ||
          contentType.includes('video/') ||
          contentType.includes('audio/') ||
          contentType.includes('application/zip') ||
          contentType.includes('application/x-gzip')) {
        return false;
      }
    }

    return true;
  }

  private calculateSize(data: any): number {
    if (typeof data === 'string') {
      return Buffer.byteLength(data, 'utf8');
    }
    if (Buffer.isBuffer(data)) {
      return data.length;
    }
    if (typeof data === 'object') {
      return Buffer.byteLength(JSON.stringify(data), 'utf8');
    }
    return 0;
  }
} 
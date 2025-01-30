import { Request, Response, NextFunction } from 'express';
import analyticsManager from '../services/analytics-manager.js';
import { AppError } from './error-handler.js';

interface TrackingMetadata {
  timestamp: Date;
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
  endpoint?: string;
  method?: string;
  statusCode?: number;
  responseTime?: number;
  status?: string;
  path?: string;
  referrer?: string;
  type?: string;
  message?: string;
  stack?: string;
}

interface ApiEventData {
  endpoint: string;
  method: string;
  statusCode: number;
  responseTime: number;
}

interface ErrorEventData {
  error: {
    type: string;
    message: string;
    stack?: string;
  };
}

interface PageViewEventData {
  path: string;
  referrer: string;
}

export function trackApiMetrics(req: Request, res: Response, next: NextFunction): void {
  const startTime = Date.now();
  const originalEnd = res.end;

  res.end = function(
    this: Response,
    chunk: any,
    encoding?: string | (() => void),
    cb?: () => void
  ): Response {
    const responseTime = Date.now() - startTime;
    const metadata: TrackingMetadata = {
      endpoint: req.path,
      method: req.method,
      statusCode: res.statusCode,
      responseTime,
      timestamp: new Date(),
      userId: req.user?.id,
      ipAddress: req.ip,
      userAgent: req.get('user-agent') || ''
    };

    const eventData: ApiEventData = {
      endpoint: req.path,
      method: req.method,
      statusCode: res.statusCode,
      responseTime
    };

    void analyticsManager.trackEvent(analyticsManager.eventTypes.API_CALL, eventData, metadata)
      .catch((trackingError: Error) => {
        console.error('Error tracking API metrics:', trackingError);
      });

    if (typeof encoding === 'function') {
      cb = encoding;
      encoding = undefined;
    }

    return originalEnd.call(this, chunk, encoding as BufferEncoding, cb);
  };

  next();
}

export function trackErrors(error: AppError | Error, req: Request, res: Response, next: NextFunction): void {
  const metadata: TrackingMetadata = {
    endpoint: req.path,
    method: req.method,
    statusCode: res.statusCode,
    status: 'error',
    type: error instanceof AppError ? error.status : 'UnknownError',
    message: error.message,
    stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    timestamp: new Date(),
    userId: req.user?.id,
    ipAddress: req.ip,
    userAgent: req.get('user-agent') || ''
  };

  const eventData: ErrorEventData = {
    error: {
      type: error instanceof AppError ? error.status : 'UnknownError',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }
  };

  void analyticsManager.trackEvent(analyticsManager.eventTypes.ERROR, eventData, metadata)
    .catch((trackingError: Error) => {
      console.error('Error tracking error event:', trackingError);
    });

  next(error);
}

export function trackPageView(req: Request, res: Response, next: NextFunction): void {
  const metadata: TrackingMetadata = {
    path: req.path,
    referrer: req.get('referrer') || '',
    timestamp: new Date(),
    userId: req.user?.id,
    ipAddress: req.ip,
    userAgent: req.get('user-agent') || ''
  };

  const eventData: PageViewEventData = {
    path: req.path,
    referrer: req.get('referrer') || ''
  };

  void analyticsManager.trackEvent(analyticsManager.eventTypes.PAGE_VIEW, eventData, metadata)
    .catch((trackingError: Error) => {
      console.error('Error tracking page view:', trackingError);
    });

  next();
} 
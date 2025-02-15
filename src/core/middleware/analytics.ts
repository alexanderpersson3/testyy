import type { Request, Response, NextFunction } from '../types/express.js';
import { AnalyticsManager } from '../services/analytics-manager.js';;
import { AppError } from '../utils/error.js';;
import type { AuthenticatedRequest } from '../types/express.js';
import { logger } from '../services/logging.service.js';;
import { ObjectId } from 'mongodb';;;;
const analyticsManager = AnalyticsManager.getInstance();

type EventType = 'API_CALL' | 'ERROR' | 'PAGE_VIEW';

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

interface ErrorEvent extends Error {
  type: string;
  userId?: string;
  metadata?: {
    path?: string;
    method?: string;
    query?: any;
    body?: any;
    headers?: any;
    timestamp?: Date;
  };
}

interface PageViewEventData {
  path: string;
  referrer: string;
}

async function logError(event: ErrorEvent): Promise<void> {
  // Log error event
  logger.error('Error event:', event);
}

export function trackApiMetrics(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const startTime = Date.now();
  const originalEnd = res.end;

  res.end = function (
    this: Response,
    chunk?: any,
    encoding?: BufferEncoding | (() => void),
    cb?: () => void
  ): Response {
    const responseTime = Date.now() - startTime;
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user?.id && ObjectId.isValid(authReq.user.id) 
      ? new ObjectId(authReq.user.id) 
      : undefined;

    const eventData: ApiEventData = {
      endpoint: req.path,
      method: req.method,
      statusCode: res.statusCode,
      responseTime,
    };

    analyticsManager
      .trackEvent('API_CALL' as EventType, eventData, userId)
      .catch((trackingError: Error) => {
        logger.error('Error tracking API metrics:', trackingError);
      });

    if (typeof encoding === 'function') {
      cb = encoding;
      encoding = undefined;
    }

    return originalEnd.call(this, chunk, encoding as BufferEncoding, cb);
  };

  next();
}

export async function trackErrors(
  error: AppError | Error,
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authReq = req as AuthenticatedRequest;
  const errorType = error instanceof AppError ? error.statusCode.toString() : 'UnknownError';
  const userId = authReq.user?.id && ObjectId.isValid(authReq.user.id)
    ? new ObjectId(authReq.user.id)
    : undefined;

  // Log to error tracking service
  if (process.env.NODE_ENV === 'production') {
    const errorEvent: ErrorEvent = Object.assign(new Error(error.message), {
      type: errorType,
      userId: authReq.user?.id,
      metadata: {
        path: req.path,
        method: req.method,
        query: req.query,
        body: req.body,
        headers: req.headers,
        timestamp: new Date(),
      },
    });
    await logError(errorEvent);
  }

  const eventData: ErrorEventData = {
    error: {
      type: errorType,
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    },
  };

  await analyticsManager
      .trackEvent('ERROR' as EventType, eventData, userId)
    .catch((trackingError: Error) => {
      logger.error('Error tracking error event:', trackingError);
    });

  // Continue to error handler
  next(error);
}

export function trackPageView(
  req: Request,
  res: Response, 
  next: NextFunction
): void {
  const authReq = req as AuthenticatedRequest;
  const userId = authReq.user?.id && ObjectId.isValid(authReq.user.id)
    ? new ObjectId(authReq.user.id)
    : undefined;

  const eventData: PageViewEventData = {
    path: req.path,
    referrer: req.get('referrer') || '',
  };

  analyticsManager
      .trackEvent('PAGE_VIEW' as EventType, eventData, userId)
    .catch((trackingError: Error) => {
      logger.error('Error tracking page view:', trackingError);
    });

  next();
}

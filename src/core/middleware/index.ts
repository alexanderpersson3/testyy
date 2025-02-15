import type { Application, Request, Response, NextFunction, RequestHandler } from '../types/express.js';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';

// Core middleware
import { auth } from './auth.js';;
import { requireAdmin } from './admin.js';;
import { rateLimitMiddleware, cleanupRateLimits } from './rate-limit.js';;
import { errorHandler } from './error-handler.js';;
import { requestLogger } from './request-logger.js';;
import { responseTime } from './response-time.js';;
import { setupSecurity, validateApiKey, requestSizeLimiter, sqlInjectionProtection, xssProtection, AppError } from './security.js';;

// Feature-specific middleware
import { upload } from './upload.js';;
import { requireRole, requireAnyRole } from './role.js';;
import { cacheMiddleware } from './cache.js';;
import { trackApiMetrics, trackErrors, trackPageView } from './analytics.js';;
import { setupLogging } from './logging.js';;
import { monitoringMiddleware } from './monitoring.js';;
import { checkSubscription, requirePremiumAccess, checkPremiumAccess, attachPremiumStatus, checkSubscriptionStatus } from './subscription-check.js';;

// Types
import type { validateRequest } from '../types/express.js';

// Configuration interfaces
interface SecurityConfig {
  corsOrigin?: string;
  maxRequestSize?: string;
  rateLimitWindowMs?: number;
  rateLimitMax?: number;
}

interface CacheConfig {
  ttl?: number;
  prefix?: string;
}

interface LoggingConfig {
  level?: string;
  format?: string;
}

interface MonitoringConfig {
  enabled?: boolean;
  sampleRate?: number;
}

interface MiddlewareConfig {
  security?: SecurityConfig;
  cache?: CacheConfig;
  logging?: LoggingConfig;
  monitoring?: MonitoringConfig;
}

// Value exports
export {
  auth,
  requireAdmin,
  rateLimitMiddleware,
  cleanupRateLimits,
  errorHandler,
  setupSecurity,
  validateApiKey,
  requestSizeLimiter,
  sqlInjectionProtection,
  xssProtection,
  AppError,
  upload,
  requireRole,
  requireAnyRole,
  cacheMiddleware,
  trackApiMetrics,
  trackErrors,
  trackPageView,
  setupLogging,
  monitoringMiddleware,
  checkSubscription,
  requirePremiumAccess,
  checkPremiumAccess,
  attachPremiumStatus,
  checkSubscriptionStatus
};

// Type exports
export type {
  validateRequest,
  MiddlewareConfig,
  SecurityConfig,
  CacheConfig,
  LoggingConfig,
  MonitoringConfig
};

/**
 * Setup function to apply all middleware with configuration
 */
export const setupMiddleware = (app: Application, config: MiddlewareConfig = {}): void => {
  // Basic middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cors({
    origin: config.security?.corsOrigin || '*',
    credentials: true
  }));
  app.use(helmet());
  app.use(compression());

  // Security
  setupSecurity(app);

  // Request size limits
  if (config.security?.maxRequestSize) {
    app.use(express.urlencoded({ extended: true }));
  }

  // Logging
  if (process.env.NODE_ENV !== 'test') {
    app.use(morgan('dev'));
  }

  // Request tracking
  app.use((req: Request, res: Response, next: NextFunction) => {
    const middleware = requestLogger as unknown as RequestHandler;
    return middleware(req, res, next);
  });
  app.use((req: Request, res: Response, next: NextFunction) => {
    const middleware = responseTime as unknown as RequestHandler;
    return middleware(req, res, next);
  });

  // Rate limiting
  if (config.security) {
    const rateLimit = rateLimitMiddleware.api() as unknown as RequestHandler;
    app.use(rateLimit);
  }

  // Caching
  if (config.cache) {
    app.use(cacheMiddleware(config.cache));
  }

  // Analytics & Monitoring
  app.use(trackApiMetrics);
  if (config.monitoring?.enabled) {
    app.use(monitoringMiddleware);
  }

  // Error handling (should be last)
  app.use(errorHandler);
};

export * from './auth.middleware.js';
export * from './error.middleware.js';
export * from './validate.middleware.js';

// Re-export commonly used middleware
export { authenticate } from './auth.middleware.js';
export { errorHandler } from './error.middleware.js';
export { validateRequest } from './validate.middleware.js';

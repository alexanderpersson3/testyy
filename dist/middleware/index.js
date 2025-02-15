import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
// Core middleware
import { auth } from './auth.js';
import { requireAdmin } from './admin.js';
import { rateLimitMiddleware, cleanupRateLimits } from './rate-limit.js';
import { errorHandler } from './error-handler.js';
import { requestLogger } from './request-logger.js';
import { responseTime } from './response-time.js';
import { setupSecurity, validateApiKey, requestSizeLimiter, sqlInjectionProtection, xssProtection, AppError } from './security.js';
// Feature-specific middleware
import { upload } from './upload.js';
import { requireRole, requireAnyRole } from './role.js';
import { cacheMiddleware } from './cache.js';
import { trackApiMetrics, trackErrors, trackPageView } from './analytics.js';
import { setupLogging } from './logging.js';
import { monitoringMiddleware } from './monitoring.js';
import { checkSubscription, requirePremiumAccess, checkPremiumAccess, attachPremiumStatus, checkSubscriptionStatus } from './subscription-check.js';
// Value exports
export { auth, requireAdmin, rateLimitMiddleware, cleanupRateLimits, errorHandler, setupSecurity, validateApiKey, requestSizeLimiter, sqlInjectionProtection, xssProtection, AppError, upload, requireRole, requireAnyRole, cacheMiddleware, trackApiMetrics, trackErrors, trackPageView, setupLogging, monitoringMiddleware, checkSubscription, requirePremiumAccess, checkPremiumAccess, attachPremiumStatus, checkSubscriptionStatus };
/**
 * Setup function to apply all middleware with configuration
 */
export const setupMiddleware = (app, config = {}) => {
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
    app.use((req, res, next) => {
        const middleware = requestLogger;
        return middleware(req, res, next);
    });
    app.use((req, res, next) => {
        const middleware = responseTime;
        return middleware(req, res, next);
    });
    // Rate limiting
    if (config.security) {
        const rateLimit = rateLimitMiddleware.api();
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
//# sourceMappingURL=index.js.map
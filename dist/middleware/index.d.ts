import type { Application } from '../types/index.js';
import { auth } from './auth.js';
import { requireAdmin } from './admin.js';
import { rateLimitMiddleware, cleanupRateLimits } from './rate-limit.js';
import { errorHandler } from './error-handler.js';
import { setupSecurity, validateApiKey, requestSizeLimiter, sqlInjectionProtection, xssProtection, AppError } from './security.js';
import { upload } from './upload.js';
import { requireRole, requireAnyRole } from './role.js';
import { cacheMiddleware } from './cache.js';
import { trackApiMetrics, trackErrors, trackPageView } from './analytics.js';
import { setupLogging } from './logging.js';
import { monitoringMiddleware } from './monitoring.js';
import { checkSubscription, requirePremiumAccess, checkPremiumAccess, attachPremiumStatus, checkSubscriptionStatus } from './subscription-check.js';
import type { validateRequest } from '../types/index.js';
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
export { auth, requireAdmin, rateLimitMiddleware, cleanupRateLimits, errorHandler, setupSecurity, validateApiKey, requestSizeLimiter, sqlInjectionProtection, xssProtection, AppError, upload, requireRole, requireAnyRole, cacheMiddleware, trackApiMetrics, trackErrors, trackPageView, setupLogging, monitoringMiddleware, checkSubscription, requirePremiumAccess, checkPremiumAccess, attachPremiumStatus, checkSubscriptionStatus };
export type { validateRequest, MiddlewareConfig, SecurityConfig, CacheConfig, LoggingConfig, MonitoringConfig };
/**
 * Setup function to apply all middleware with configuration
 */
export declare const setupMiddleware: (app: Application, config?: MiddlewareConfig) => void;

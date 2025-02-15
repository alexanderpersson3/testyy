import { AnalyticsManager } from '../services/analytics-manager.js';
import { AppError } from '../utils/error.js';
import { logger } from '../services/logging.service.js';
import { ObjectId } from 'mongodb';
;
const analyticsManager = AnalyticsManager.getInstance();
async function logError(event) {
    // Log error event
    logger.error('Error event:', event);
}
export function trackApiMetrics(req, res, next) {
    const startTime = Date.now();
    const originalEnd = res.end;
    res.end = function (chunk, encoding, cb) {
        const responseTime = Date.now() - startTime;
        const authReq = req;
        const userId = authReq.user?.id && ObjectId.isValid(authReq.user.id)
            ? new ObjectId(authReq.user.id)
            : undefined;
        const eventData = {
            endpoint: req.path,
            method: req.method,
            statusCode: res.statusCode,
            responseTime,
        };
        analyticsManager
            .trackEvent('API_CALL', eventData, userId)
            .catch((trackingError) => {
            logger.error('Error tracking API metrics:', trackingError);
        });
        if (typeof encoding === 'function') {
            cb = encoding;
            encoding = undefined;
        }
        return originalEnd.call(this, chunk, encoding, cb);
    };
    next();
}
export async function trackErrors(error, req, res, next) {
    const authReq = req;
    const errorType = error instanceof AppError ? error.statusCode.toString() : 'UnknownError';
    const userId = authReq.user?.id && ObjectId.isValid(authReq.user.id)
        ? new ObjectId(authReq.user.id)
        : undefined;
    // Log to error tracking service
    if (process.env.NODE_ENV === 'production') {
        const errorEvent = Object.assign(new Error(error.message), {
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
    const eventData = {
        error: {
            type: errorType,
            message: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
        },
    };
    await analyticsManager
        .trackEvent('ERROR', eventData, userId)
        .catch((trackingError) => {
        logger.error('Error tracking error event:', trackingError);
    });
    // Continue to error handler
    next(error);
}
export function trackPageView(req, res, next) {
    const authReq = req;
    const userId = authReq.user?.id && ObjectId.isValid(authReq.user.id)
        ? new ObjectId(authReq.user.id)
        : undefined;
    const eventData = {
        path: req.path,
        referrer: req.get('referrer') || '',
    };
    analyticsManager
        .trackEvent('PAGE_VIEW', eventData, userId)
        .catch((trackingError) => {
        logger.error('Error tracking page view:', trackingError);
    });
    next();
}
//# sourceMappingURL=analytics.js.map
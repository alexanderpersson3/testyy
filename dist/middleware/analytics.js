import analyticsManager from '../services/analytics-manager.js';
import { AppError } from './error-handler.js';
export function trackApiMetrics(req, res, next) {
    const startTime = Date.now();
    const originalEnd = res.end;
    res.end = function (chunk, encoding, cb) {
        const responseTime = Date.now() - startTime;
        const metadata = {
            endpoint: req.path,
            method: req.method,
            statusCode: res.statusCode,
            responseTime,
            timestamp: new Date(),
            userId: req.user?.id,
            ipAddress: req.ip,
            userAgent: req.get('user-agent') || ''
        };
        const eventData = {
            endpoint: req.path,
            method: req.method,
            statusCode: res.statusCode,
            responseTime
        };
        void analyticsManager.trackEvent(analyticsManager.eventTypes.API_CALL, eventData, metadata)
            .catch((trackingError) => {
            console.error('Error tracking API metrics:', trackingError);
        });
        if (typeof encoding === 'function') {
            cb = encoding;
            encoding = undefined;
        }
        return originalEnd.call(this, chunk, encoding, cb);
    };
    next();
}
export function trackErrors(error, req, res, next) {
    const metadata = {
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
    const eventData = {
        error: {
            type: error instanceof AppError ? error.status : 'UnknownError',
            message: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        }
    };
    void analyticsManager.trackEvent(analyticsManager.eventTypes.ERROR, eventData, metadata)
        .catch((trackingError) => {
        console.error('Error tracking error event:', trackingError);
    });
    next(error);
}
export function trackPageView(req, res, next) {
    const metadata = {
        path: req.path,
        referrer: req.get('referrer') || '',
        timestamp: new Date(),
        userId: req.user?.id,
        ipAddress: req.ip,
        userAgent: req.get('user-agent') || ''
    };
    const eventData = {
        path: req.path,
        referrer: req.get('referrer') || ''
    };
    void analyticsManager.trackEvent(analyticsManager.eventTypes.PAGE_VIEW, eventData, metadata)
        .catch((trackingError) => {
        console.error('Error tracking page view:', trackingError);
    });
    next();
}
//# sourceMappingURL=analytics.js.map
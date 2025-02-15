import { monitoring } from '../services/monitoring.service.js';
import { logger } from '../services/logging.service.js';
export const monitoringMiddleware = (req, res, next) => {
    const start = process.hrtime();
    // Log request
    logger.http(`Incoming ${req.method} request to ${req.url}`, req);
    // Add response listener
    res.on('finish', () => {
        // Calculate duration
        const [seconds, nanoseconds] = process.hrtime(start);
        const duration = seconds + nanoseconds / 1e9;
        // Prepare monitoring request object
        const monitoringReq = {
            path: req.path,
            method: req.method,
            headers: Object.fromEntries(Object.entries(req.headers).map(([key, value]) => [
                key,
                Array.isArray(value) ? value.join(', ') : value || ''
            ])),
            query: Object.fromEntries(Object.entries(req.query).map(([key, value]) => [
                key,
                Array.isArray(value) ? value.join(', ') : String(value || '')
            ]))
        };
        // Prepare monitoring response object
        const monitoringRes = {
            statusCode: res.statusCode,
            headers: Object.fromEntries(Object.entries(res.getHeaders()).map(([key, value]) => [
                key,
                Array.isArray(value) ? value.join(', ') : String(value || '')
            ])),
            body: {} // We don't track response body for privacy/security reasons
        };
        // Track request in monitoring
        monitoring.trackHttpRequest(monitoringReq, monitoringRes, duration);
        // Log response
        const message = `${req.method} ${req.url} ${res.statusCode} ${duration.toFixed(3)}s`;
        if (res.statusCode >= 400) {
            logger.error(message, undefined, req);
        }
        else {
            logger.info(message, req);
        }
    });
    next();
};
//# sourceMappingURL=monitoring.js.map
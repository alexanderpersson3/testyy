import logger from '../utils/logger.js';
export const requestLogger = (req, res, next) => {
    const start = Date.now();
    try {
        // Log request
        logger.info({
            method: req.method,
            url: req.url,
            ip: req.ip,
            userAgent: req.get('user-agent'),
        });
        // Log response
        res.on('finish', () => {
            const duration = Date.now() - start;
            logger.info({
                method: req.method,
                url: req.url,
                status: res.statusCode,
                duration: `${duration}ms`,
            });
        });
    }
    catch (error) {
        logger.error('Request logging error:', error);
    }
    next();
};
//# sourceMappingURL=request-logger.js.map
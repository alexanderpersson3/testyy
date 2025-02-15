import morgan from 'morgan';
import { logger } from '../services/logging.service.js';
export const setupLogging = (app) => {
    // Development logging
    if (process.env.NODE_ENV === 'development') {
        app.use(morgan('dev'));
    }
    // Production logging
    if (process.env.NODE_ENV === 'production') {
        app.use(morgan('combined', {
            stream: {
                write: (message) => {
                    logger.info(message.trim());
                },
            },
        }));
    }
    // Request logging middleware
    app.use((req, res, next) => {
        const start = Date.now();
        res.on('finish', () => {
            const duration = Date.now() - start;
            const message = `${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`;
            if (res.statusCode >= 500) {
                logger.error(message);
            }
            else if (res.statusCode >= 400) {
                logger.warn(message);
            }
            else {
                logger.info(message);
            }
        });
        next();
    });
    // Error logging middleware
    app.use((err, req, res, next) => {
        const message = `Unhandled error in ${req.method} ${req.originalUrl}: ${err.message}`;
        logger.error(message, err);
        next(err);
    });
};
//# sourceMappingURL=logging.js.map
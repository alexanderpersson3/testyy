import { ZodError } from 'zod';
import { MongoError } from 'mongodb';
import { NotFoundError, DatabaseError, ForbiddenError, ValidationError, AppError } from '../utils/errors.js';
import logger from '../utils/logger.js';
import { MonitoringService } from '../services/monitoring.service.js';
function isKnownError(error) {
    return (error instanceof AppError ||
        error instanceof ZodError ||
        error instanceof ValidationError ||
        error instanceof DatabaseError ||
        error instanceof MongoError ||
        error instanceof NotFoundError ||
        error instanceof ForbiddenError);
}
const monitoring = MonitoringService.getInstance();
const DEFAULT_ERROR_STATUS = 500;
const ERROR_STATUS_MAP = {
    ValidationError: 400,
    NotFoundError: 404,
    ForbiddenError: 403,
    DatabaseError: 500,
    MongoError: 500,
    ZodError: 400,
};
function getErrorStatus(error) {
    if (error instanceof AppError) {
        return error.status;
    }
    const statusProperty = 'status' in error ? error.status : undefined;
    if (typeof statusProperty === 'number') {
        return statusProperty;
    }
    const statusCodeProperty = 'statusCode' in error ? error.statusCode : undefined;
    if (typeof statusCodeProperty === 'number') {
        return statusCodeProperty;
    }
    return ERROR_STATUS_MAP[error.constructor.name] || DEFAULT_ERROR_STATUS;
}
export const errorHandler = (err, req, res, next) => {
    const status = getErrorStatus(err);
    const errorCode = err.constructor.name;
    const response = {
        error: err.message || 'Internal Server Error',
        code: errorCode,
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'],
    };
    // Add details for specific error types
    if (err instanceof ZodError) {
        response.error = 'Validation failed';
        response.details = err.errors;
    }
    else if (err instanceof ValidationError) {
        response.error = err.message;
    }
    else if (err instanceof DatabaseError || err instanceof MongoError) {
        response.error = 'Database operation failed';
        // Hide internal error details in production
        if (process.env.NODE_ENV === 'development') {
            response.details = err.message;
        }
    }
    // Add stack trace in development
    if (process.env.NODE_ENV === 'development') {
        response.stack = err.stack;
    }
    // Log error with context
    logger.error('Request error:', {
        ...response,
        url: req.url,
        method: req.method,
        body: req.body,
        params: req.params,
        query: req.query,
        headers: req.headers,
        ip: req.ip,
    });
    // Record error metrics
    monitoring.recordMetric({
        name: 'error_count',
        value: 1,
        labels: {
            type: errorCode,
            status: status.toString(),
            path: req.path,
            method: req.method
        }
    });
    monitoring.recordError(errorCode, err);
    res.status(status).json(response);
};
// Handle process events
function setupProcessHandlers() {
    let shuttingDown = false;
    async function shutdown(signal) {
        if (shuttingDown)
            return;
        shuttingDown = true;
        logger.info(`Received ${signal}, starting graceful shutdown...`);
        try {
            // Record shutdown metric before exiting
            monitoring.recordMetric({
                name: 'shutdown',
                value: 1,
                labels: {
                    reason: signal,
                    success: 'true'
                }
            });
            logger.info('Graceful shutdown completed');
            process.exit(0);
        }
        catch (error) {
            logger.error('Error during shutdown:', error);
            process.exit(1);
        }
    }
    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
        logger.error('Uncaught Exception:', error);
        shutdown('UNCAUGHT_EXCEPTION').catch(() => process.exit(1));
    });
    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason) => {
        logger.error('Unhandled Rejection:', reason instanceof Error ? reason : new Error(String(reason)));
        shutdown('UNHANDLED_REJECTION').catch(() => process.exit(1));
    });
    // Handle termination signals
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
}
setupProcessHandlers();
//# sourceMappingURL=error-handler.js.map
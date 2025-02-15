import { ZodError } from 'zod';
import logger from '../utils/logger.js';
export class AppError extends Error {
    constructor(message, statusCode = 500, isOperational = true) {
        super(message);
        this.message = message;
        this.statusCode = statusCode;
        this.isOperational = isOperational;
        Object.setPrototypeOf(this, AppError.prototype);
    }
}
export const errorHandler = (err, req, res, next) => {
    if (err instanceof AppError) {
        res.status(err.statusCode).json({
            error: err.message,
        });
        return;
    }
    if (err instanceof ZodError) {
        res.status(400).json({
            error: 'Validation failed',
            details: err.errors.map(e => ({
                path: e.path.join('.'),
                message: e.message,
            })),
        });
        return;
    }
    logger.error('Unhandled error:', err);
    res.status(500).json({
        error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
    });
};
export default errorHandler;
//# sourceMappingURL=error.js.map
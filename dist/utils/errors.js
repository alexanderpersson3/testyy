import logger from './logger.js';
/**
 * Base error class for application errors
 */
export class AppError extends Error {
    constructor(message, statusCode = 500, code = 'APP_ERROR', data) {
        super(message);
        this.message = message;
        this.statusCode = statusCode;
        this.code = code;
        this.data = data;
        this.name = this.constructor.name;
        Error.captureStackTrace(this, this.constructor);
    }
    toJSON() {
        return {
            error: {
                message: this.message,
                code: this.code,
                data: this.data,
            },
        };
    }
}
/**
 * Validation error
 */
export class ValidationError extends AppError {
    constructor(message, data) {
        super(message, 400, 'VALIDATION_ERROR', data);
    }
}
/**
 * Authentication error
 */
export class AuthenticationError extends AppError {
    constructor(message, data) {
        super(message, 401, 'AUTHENTICATION_ERROR', data);
    }
}
/**
 * Authorization error
 */
export class AuthorizationError extends AppError {
    constructor(message, data) {
        super(message, 403, 'AUTHORIZATION_ERROR', data);
    }
}
/**
 * Not found error
 */
export class NotFoundError extends AppError {
    constructor(message, data) {
        super(message, 404, 'NOT_FOUND_ERROR', data);
    }
}
/**
 * Conflict error
 */
export class ConflictError extends AppError {
    constructor(message, data) {
        super(message, 409, 'CONFLICT_ERROR', data);
    }
}
/**
 * Rate limit error
 */
export class RateLimitError extends AppError {
    constructor(message, data) {
        super(message, 429, 'RATE_LIMIT_ERROR', data);
    }
}
/**
 * Database error
 */
export class InternalServerError extends AppError {
    constructor(message, data) {
        super(message, 500, 'INTERNAL_SERVER_ERROR', data);
    }
}
/**
 * External service error
 */
export class ServiceUnavailableError extends AppError {
    constructor(message) {
        super(message, 503);
        this.name = 'ServiceUnavailableError';
    }
}
/**
 * WebSocket error
 */
export class WebSocketError extends AppError {
    constructor(message = 'WebSocket error occurred') {
        super(message, 500);
        this.name = 'WebSocketError';
    }
}
/**
 * Bad gateway error
 */
export class BadGatewayError extends AppError {
    constructor(message) {
        super(message, 502);
        this.name = 'BadGatewayError';
    }
}
/**
 * Error handler utility
 */
export function handleError(error, res) {
    if (error instanceof AppError) {
        res.status(error.statusCode).json(error.toJSON());
    }
    else {
        logger.error('Unhandled error:', error);
        res.status(500).json({
            error: {
                message: 'Internal server error',
                code: 'INTERNAL_SERVER_ERROR',
            },
        });
    }
}
/**
 * Async route handler wrapper
 */
export function asyncHandler(fn) {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}
/**
 * Error response helper
 */
export function errorResponse(res, error) {
    if (error instanceof AppError) {
        res.status(error.statusCode).json(error.toJSON());
    }
    else {
        logger.error('Unhandled error:', error);
        res.status(500).json({
            error: {
                message: 'Internal server error',
                code: 'INTERNAL_SERVER_ERROR',
            },
        });
    }
}
export class UnauthorizedError extends AppError {
    constructor(message = 'Unauthorized') {
        super(message, 401);
        this.name = 'UnauthorizedError';
    }
}
// Type guard for AppError
export function isAppError(error) {
    return error instanceof AppError;
}
// Type guard for specific error types
export function isValidationError(error) {
    return error instanceof ValidationError;
}
export function isNotFoundError(error) {
    return error instanceof NotFoundError;
}
export function isAuthenticationError(error) {
    return error instanceof AuthenticationError;
}
export function isAuthorizationError(error) {
    return error instanceof AuthorizationError;
}
export function isConflictError(error) {
    return error instanceof ConflictError;
}
export function isRateLimitError(error) {
    return error instanceof RateLimitError;
}
export function isInternalServerError(error) {
    return error instanceof InternalServerError;
}
//# sourceMappingURL=errors.js.map
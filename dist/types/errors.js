/**
 * Base error class for application errors
 */
export class AppError extends Error {
    constructor(statusCode, message, code, data) {
        super(message);
        this.statusCode = statusCode;
        this.message = message;
        this.code = code;
        this.data = data;
        Object.setPrototypeOf(this, AppError.prototype);
    }
}
/**
 * Error thrown when validation fails
 */
export class ValidationError extends AppError {
    constructor(message, data) {
        super(400, message, 'VALIDATION_ERROR', data);
        Object.setPrototypeOf(this, ValidationError.prototype);
    }
}
/**
 * Error thrown when a resource is not found
 */
export class NotFoundError extends AppError {
    constructor(message, data) {
        super(404, message, 'NOT_FOUND', data);
        Object.setPrototypeOf(this, NotFoundError.prototype);
    }
}
/**
 * Error thrown when authentication fails
 */
export class AuthenticationError extends AppError {
    constructor(message, data) {
        super(401, message, 'AUTHENTICATION_ERROR', data);
        Object.setPrototypeOf(this, AuthenticationError.prototype);
    }
}
/**
 * Error thrown when authorization fails
 */
export class AuthorizationError extends AppError {
    constructor(message, data) {
        super(403, message, 'AUTHORIZATION_ERROR', data);
        Object.setPrototypeOf(this, AuthorizationError.prototype);
    }
}
/**
 * Error thrown when a conflict occurs
 */
export class ConflictError extends AppError {
    constructor(message, data) {
        super(409, message, 'CONFLICT_ERROR', data);
        Object.setPrototypeOf(this, ConflictError.prototype);
    }
}
/**
 * Error thrown when rate limit is exceeded
 */
export class RateLimitError extends AppError {
    constructor(message, data) {
        super(429, message, 'RATE_LIMIT_ERROR', data);
        Object.setPrototypeOf(this, RateLimitError.prototype);
    }
}
/**
 * Error thrown when an internal server error occurs
 */
export class InternalServerError extends AppError {
    constructor(message, data) {
        super(500, message, 'INTERNAL_SERVER_ERROR', data);
        Object.setPrototypeOf(this, InternalServerError.prototype);
    }
}
//# sourceMappingURL=errors.js.map
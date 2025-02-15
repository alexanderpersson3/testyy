/**
 * Base error class for application errors
 */
export declare class AppError extends Error {
    statusCode: number;
    message: string;
    code: string;
    data?: any | undefined;
    constructor(statusCode: number, message: string, code: string, data?: any | undefined);
}
/**
 * Error thrown when validation fails
 */
export declare class ValidationError extends AppError {
    constructor(message: string, data?: any);
}
/**
 * Error thrown when a resource is not found
 */
export declare class NotFoundError extends AppError {
    constructor(message: string, data?: any);
}
/**
 * Error thrown when authentication fails
 */
export declare class AuthenticationError extends AppError {
    constructor(message: string, data?: any);
}
/**
 * Error thrown when authorization fails
 */
export declare class AuthorizationError extends AppError {
    constructor(message: string, data?: any);
}
/**
 * Error thrown when a conflict occurs
 */
export declare class ConflictError extends AppError {
    constructor(message: string, data?: any);
}
/**
 * Error thrown when rate limit is exceeded
 */
export declare class RateLimitError extends AppError {
    constructor(message: string, data?: any);
}
/**
 * Error thrown when an internal server error occurs
 */
export declare class InternalServerError extends AppError {
    constructor(message: string, data?: any);
}

import type { Response } from '../types/index.js';
/**
 * Base error class for application errors
 */
export declare class AppError extends Error {
    message: string;
    readonly statusCode: number;
    readonly code: string;
    readonly data?: Record<string, unknown> | undefined;
    constructor(message: string, statusCode?: number, code?: string, data?: Record<string, unknown> | undefined);
    toJSON(): {
        error: {
            message: string;
            code: string;
            data: Record<string, unknown> | undefined;
        };
    };
}
/**
 * Validation error
 */
export declare class ValidationError extends AppError {
    constructor(message: string, data?: Record<string, unknown>);
}
/**
 * Authentication error
 */
export declare class AuthenticationError extends AppError {
    constructor(message: string, data?: Record<string, unknown>);
}
/**
 * Authorization error
 */
export declare class AuthorizationError extends AppError {
    constructor(message: string, data?: Record<string, unknown>);
}
/**
 * Not found error
 */
export declare class NotFoundError extends AppError {
    constructor(message: string, data?: Record<string, unknown>);
}
/**
 * Conflict error
 */
export declare class ConflictError extends AppError {
    constructor(message: string, data?: Record<string, unknown>);
}
/**
 * Rate limit error
 */
export declare class RateLimitError extends AppError {
    constructor(message: string, data?: Record<string, unknown>);
}
/**
 * Database error
 */
export declare class InternalServerError extends AppError {
    constructor(message: string, data?: Record<string, unknown>);
}
/**
 * External service error
 */
export declare class ServiceUnavailableError extends AppError {
    constructor(message: string);
}
/**
 * WebSocket error
 */
export declare class WebSocketError extends AppError {
    constructor(message?: string);
}
/**
 * Bad gateway error
 */
export declare class BadGatewayError extends AppError {
    constructor(message: string);
}
/**
 * Error handler utility
 */
export declare function handleError(error: Error, res: Response): void;
/**
 * Async route handler wrapper
 */
export declare function asyncHandler(fn: Function): (req: any, res: any, next: any) => void;
/**
 * Error response helper
 */
export declare function errorResponse(res: Response, error: AppError | Error): void;
export declare class UnauthorizedError extends AppError {
    constructor(message?: string);
}
export declare function isAppError(error: unknown): error is AppError;
export declare function isValidationError(error: unknown): error is ValidationError;
export declare function isNotFoundError(error: unknown): error is NotFoundError;
export declare function isAuthenticationError(error: unknown): error is AuthenticationError;
export declare function isAuthorizationError(error: unknown): error is AuthorizationError;
export declare function isConflictError(error: unknown): error is ConflictError;
export declare function isRateLimitError(error: unknown): error is RateLimitError;
export declare function isInternalServerError(error: unknown): error is InternalServerError;
export interface ErrorResponse {
    status: 'error';
    code: string;
    message: string;
    data?: Record<string, unknown>;
}

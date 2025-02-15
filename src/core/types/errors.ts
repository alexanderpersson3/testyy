/**
 * Base error class for all application errors
 */
export class AppError extends Error {
  constructor(
    public readonly code: string,
    public override readonly message: string,
    public readonly statusCode: number = 500,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Error thrown when a resource is not found
 */
export class NotFoundError extends AppError {
  constructor(message: string, details?: unknown) {
    super('NOT_FOUND', message, 404, details);
  }
}

/**
 * Error thrown when input validation fails
 */
export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super('VALIDATION_ERROR', message, 400, details);
  }
}

/**
 * Error thrown when authentication fails
 */
export class AuthenticationError extends AppError {
  constructor(message: string, details?: unknown) {
    super('AUTHENTICATION_ERROR', message, 401, details);
  }
}

/**
 * Error thrown when authorization fails
 */
export class AuthorizationError extends AppError {
  constructor(message: string, details?: unknown) {
    super('AUTHORIZATION_ERROR', message, 403, details);
  }
}

/**
 * Error thrown when a conflict occurs (e.g., duplicate entry)
 */
export class ConflictError extends AppError {
  constructor(message: string, details?: unknown) {
    super('CONFLICT_ERROR', message, 409, details);
  }
}

/**
 * Error thrown when a database operation fails
 */
export class DatabaseError extends AppError {
  constructor(message: string, details?: unknown) {
    super('DATABASE_ERROR', message, 500, details);
  }
}

/**
 * Error thrown when an external service request fails
 */
export class ExternalServiceError extends AppError {
  constructor(message: string, details?: unknown) {
    super('EXTERNAL_SERVICE_ERROR', message, 502, details);
  }
}

/**
 * Error thrown when rate limiting is exceeded
 */
export class RateLimitError extends AppError {
  constructor(message: string, details?: unknown) {
    super('RATE_LIMIT_ERROR', message, 429, details);
  }
}

/**
 * Error thrown when a request times out
 */
export class TimeoutError extends AppError {
  constructor(message: string, details?: unknown) {
    super('TIMEOUT_ERROR', message, 504, details);
  }
}

/**
 * Error thrown when a feature is not implemented
 */
export class NotImplementedError extends AppError {
  constructor(message: string, details?: unknown) {
    super('NOT_IMPLEMENTED', message, 501, details);
  }
}

/**
 * Error thrown when a request is malformed
 */
export class BadRequestError extends AppError {
  constructor(message: string, details?: unknown) {
    super('BAD_REQUEST', message, 400, details);
  }
}

/**
 * Error thrown when a request is too large
 */
export class PayloadTooLargeError extends AppError {
  constructor(message: string, details?: unknown) {
    super('PAYLOAD_TOO_LARGE', message, 413, details);
  }
}

/**
 * Error thrown when a request is unsupported
 */
export class UnsupportedMediaTypeError extends AppError {
  constructor(message: string, details?: unknown) {
    super('UNSUPPORTED_MEDIA_TYPE', message, 415, details);
  }
}

/**
 * Error thrown when too many requests are made
 */
export class TooManyRequestsError extends AppError {
  constructor(message: string, details?: unknown) {
    super('TOO_MANY_REQUESTS', message, 429, details);
  }
}

/**
 * Type guard to check if a value is an AppError
 */
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

/**
 * Type guard to check if a value is a specific error type
 */
export function isErrorType<T extends AppError>(
  error: unknown,
  errorType: new (...args: any[]) => T
): error is T {
  return error instanceof errorType;
}

/**
 * Helper to create an error response object
 */
export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    statusCode: number;
    details?: unknown;
  };
}

/**
 * Convert an error to an error response object
 */
export function toErrorResponse(error: unknown): ErrorResponse {
  if (isAppError(error)) {
    return {
      success: false,
      error: {
        code: error.code,
        message: error.message,
        statusCode: error.statusCode,
        details: error.details,
      },
    };
  }

  // Handle unknown errors
  const unknownError = error instanceof Error ? error : new Error('Unknown error');
  return {
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: unknownError.message,
      statusCode: 500,
    },
  };
} 
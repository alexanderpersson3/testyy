import { BaseError } from './base.error.js';

/**
 * HTTP 400 Bad Request
 */
export class BadRequestError extends BaseError {
  constructor(message: string = 'Bad Request', details?: unknown) {
    super(message, 'BAD_REQUEST', 400, details);
  }
}

/**
 * HTTP 401 Unauthorized
 */
export class UnauthorizedError extends BaseError {
  constructor(message: string = 'Unauthorized', details?: unknown) {
    super(message, 'UNAUTHORIZED', 401, details);
  }
}

/**
 * HTTP 403 Forbidden
 */
export class ForbiddenError extends BaseError {
  constructor(message: string = 'Forbidden', details?: unknown) {
    super(message, 'FORBIDDEN', 403, details);
  }
}

/**
 * HTTP 404 Not Found
 */
export class NotFoundError extends BaseError {
  constructor(message: string = 'Not Found', details?: unknown) {
    super(message, 'NOT_FOUND', 404, details);
  }
}

/**
 * HTTP 409 Conflict
 */
export class ConflictError extends BaseError {
  constructor(message: string = 'Conflict', details?: unknown) {
    super(message, 'CONFLICT', 409, details);
  }
}

/**
 * HTTP 422 Unprocessable Entity
 */
export class UnprocessableEntityError extends BaseError {
  constructor(message: string = 'Unprocessable Entity', details?: unknown) {
    super(message, 'UNPROCESSABLE_ENTITY', 422, details);
  }
}

/**
 * HTTP 429 Too Many Requests
 */
export class TooManyRequestsError extends BaseError {
  constructor(message: string = 'Too Many Requests', details?: unknown) {
    super(message, 'TOO_MANY_REQUESTS', 429, details);
  }
}

/**
 * HTTP 500 Internal Server Error
 */
export class InternalServerError extends BaseError {
  constructor(message: string = 'Internal Server Error', details?: unknown) {
    super(message, 'INTERNAL_SERVER_ERROR', 500, details);
  }
}

/**
 * HTTP 503 Service Unavailable
 */
export class ServiceUnavailableError extends BaseError {
  constructor(message: string = 'Service Unavailable', details?: unknown) {
    super(message, 'SERVICE_UNAVAILABLE', 503, details);
  }
} 
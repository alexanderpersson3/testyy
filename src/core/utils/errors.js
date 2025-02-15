// Base class for application errors
export class AppError extends Error {
  constructor(message, statusCode = 500, errorCode = 'INTERNAL_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

// Authentication Errors
export class AuthenticationError extends AppError {
  constructor(message = 'Authentication failed') {
    super(message, 401, 'AUTHENTICATION_ERROR');
  }
}

export class AuthorizationError extends AppError {
  constructor(message = 'Not authorized to access this resource') {
    super(message, 403, 'AUTHORIZATION_ERROR');
  }
}

// Validation Errors
export class ValidationError extends AppError {
  constructor(message = 'Validation failed', errors = []) {
    super(message, 400, 'VALIDATION_ERROR');
    this.errors = errors;
  }
}

// Resource Errors
export class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(`${resource} not found`, 404, 'NOT_FOUND_ERROR');
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Resource conflict') {
    super(message, 409, 'CONFLICT_ERROR');
  }
}

// Database Errors
export class DatabaseError extends AppError {
  constructor(message = 'Database operation failed') {
    super(message, 500, 'DATABASE_ERROR');
  }
}

// Rate Limiting Errors
export class RateLimitError extends AppError {
  constructor(message = 'Too many requests') {
    super(message, 429, 'RATE_LIMIT_ERROR');
  }
}

// Integration Errors
export class IntegrationError extends AppError {
  constructor(service, message = 'External service error') {
    super(`${service}: ${message}`, 502, 'INTEGRATION_ERROR');
    this.service = service;
  }
}

// Cache Errors
export class CacheError extends AppError {
  constructor(message = 'Cache operation failed') {
    super(message, 500, 'CACHE_ERROR');
  }
}

// Performance Errors
export class PerformanceError extends AppError {
  constructor(message = 'Performance threshold exceeded') {
    super(message, 503, 'PERFORMANCE_ERROR');
  }
}

// Request Timeout Error
export class TimeoutError extends AppError {
  constructor(message = 'Request timeout') {
    super(message, 504, 'TIMEOUT_ERROR');
  }
}

// Business Logic Errors
export class BusinessError extends AppError {
  constructor(message, errorCode = 'BUSINESS_ERROR') {
    super(message, 400, errorCode);
  }
}

// Helper function to determine if error is operational
export const isOperationalError = error => {
  if (error instanceof AppError) {
    return error.isOperational;
  }
  return false;
};

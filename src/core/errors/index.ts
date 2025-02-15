export * from './base.error.js';
export * from './http.errors.js';
export * from './mongodb.errors.js';
export * from './validation.error.js';
export * from './unauthorized.error.js';

// Re-export specific error types for convenience
export { NotFoundError } from './http.errors.js';
export { UnauthorizedError } from './http.errors.js';
export { ValidationError } from './validation.error.js';
export { 
  MongoError,
  MongoQueryError,
  MongoWriteError,
  MongoValidationError,
  MongoConnectionError,
  MongoTransactionError,
  MongoDuplicateKeyError,
  MongoBulkWriteError,
  MongoTimeoutError,
  MongoAuthError,
  MongoSchemaValidationError
} from './mongodb.errors.js';

export class NotFoundError extends Error {
  public readonly statusCode = 404;

  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class UnauthorizedError extends Error {
  public readonly statusCode = 401;

  constructor(message: string) {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

export interface ValidationErrorDetail {
  field: string;
  message: string;
}

export class ValidationError extends Error {
  public readonly statusCode = 400;
  public readonly errors: ValidationErrorDetail[];

  constructor(message: string, errors: ValidationErrorDetail[]) {
    super(message);
    this.name = 'ValidationError';
    this.errors = errors;
  }
}

export class InternalServerError extends Error {
  public readonly statusCode = 500;

  constructor(message = 'Internal server error') {
    super(message);
    this.name = 'InternalServerError';
  }
} 
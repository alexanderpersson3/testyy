import { AppError } from './errors.js';

/**
 * Base class for MongoDB errors
 */
export class MongoError extends AppError {
  constructor(message: string, details?: unknown) {
    super('MONGODB_ERROR', message, 500, details);
  }
}

/**
 * Error thrown when a MongoDB connection fails
 */
export class MongoConnectionError extends MongoError {
  constructor(message: string, details?: unknown) {
    super(`MongoDB connection error: ${message}`, details);
  }
}

/**
 * Error thrown when a MongoDB query fails
 */
export class MongoQueryError extends MongoError {
  constructor(message: string, details?: unknown) {
    super(`MongoDB query error: ${message}`, details);
  }
}

/**
 * Error thrown when a MongoDB write operation fails
 */
export class MongoWriteError extends MongoError {
  constructor(message: string, details?: unknown) {
    super(`MongoDB write error: ${message}`, details);
  }
}

/**
 * Error thrown when a MongoDB transaction fails
 */
export class MongoTransactionError extends MongoError {
  constructor(message: string, details?: unknown) {
    super(`MongoDB transaction error: ${message}`, details);
  }
}

/**
 * Error thrown when a MongoDB validation fails
 */
export class MongoValidationError extends MongoError {
  constructor(message: string, details?: unknown) {
    super(`MongoDB validation error: ${message}`, details);
  }
}

/**
 * Error thrown when a MongoDB document is not found
 */
export class MongoNotFoundError extends MongoError {
  constructor(message: string, details?: unknown) {
    super(`MongoDB document not found: ${message}`, details);
  }
}

/**
 * Error thrown when a MongoDB duplicate key error occurs
 */
export class MongoDuplicateKeyError extends MongoError {
  constructor(message: string, details?: unknown) {
    super(`MongoDB duplicate key error: ${message}`, details);
  }
}

/**
 * Error thrown when a MongoDB bulk write operation fails
 */
export class MongoBulkWriteError extends MongoError {
  constructor(message: string, details?: unknown) {
    super(`MongoDB bulk write error: ${message}`, details);
  }
}

/**
 * Error thrown when a MongoDB index creation fails
 */
export class MongoIndexError extends MongoError {
  constructor(message: string, details?: unknown) {
    super(`MongoDB index error: ${message}`, details);
  }
}

/**
 * Error thrown when a MongoDB timeout occurs
 */
export class MongoTimeoutError extends MongoError {
  constructor(message: string, details?: unknown) {
    super(`MongoDB timeout error: ${message}`, details);
  }
}

/**
 * Type guard to check if an error is a MongoDB error
 */
export function isMongoError(error: unknown): error is MongoError {
  return error instanceof MongoError;
}

/**
 * Type guard to check if an error is a specific MongoDB error type
 */
export function isMongoErrorType<T extends MongoError>(
  error: unknown,
  errorType: new (...args: any[]) => T
): error is T {
  return error instanceof errorType;
}

/**
 * Helper to convert MongoDB error codes to error instances
 */
export function fromMongoError(error: any): MongoError {
  // MongoDB error codes: https://github.com/mongodb/mongo/blob/master/src/mongo/base/error_codes.yml
  switch (error.code) {
    case 11000:
      return new MongoDuplicateKeyError(error.message, error);
    case 50:
      return new MongoConnectionError(error.message, error);
    case 51:
      return new MongoQueryError(error.message, error);
    case 121:
      return new MongoValidationError(error.message, error);
    case 251:
      return new MongoTransactionError(error.message, error);
    case 89:
      return new MongoTimeoutError(error.message, error);
    default:
      return new MongoError(error.message, error);
  }
} 
/**
 * Base class for MongoDB errors
 */
export class MongoError extends Error {
  constructor(message: string, public cause?: unknown) {
    super(message);
    this.name = 'MongoError';
  }
}

/**
 * Error thrown when a MongoDB query fails
 */
export class MongoQueryError extends MongoError {
  constructor(message: string, cause?: unknown) {
    super(message, cause);
    this.name = 'MongoQueryError';
  }
}

/**
 * Error thrown when a MongoDB write operation fails
 */
export class MongoWriteError extends MongoError {
  constructor(message: string, cause?: unknown) {
    super(message, cause);
    this.name = 'MongoWriteError';
  }
}

/**
 * Error thrown when MongoDB validation fails
 */
export class MongoValidationError extends MongoError {
  constructor(message: string, public validationErrors: Record<string, string>, cause?: unknown) {
    super(message, cause);
    this.name = 'MongoValidationError';
  }
}

/**
 * Error thrown when MongoDB connection fails
 */
export class MongoConnectionError extends MongoError {
  constructor(message: string, cause?: unknown) {
    super(message, cause);
    this.name = 'MongoConnectionError';
  }
}

/**
 * Error thrown when MongoDB transaction fails
 */
export class MongoTransactionError extends MongoError {
  constructor(message: string, cause?: unknown) {
    super(message, cause);
    this.name = 'MongoTransactionError';
  }
}

/**
 * Error thrown when MongoDB duplicate key violation occurs
 */
export class MongoDuplicateKeyError extends MongoError {
  constructor(message: string, public key: string, cause?: unknown) {
    super(message, cause);
    this.name = 'MongoDuplicateKeyError';
  }
}

/**
 * Error thrown when MongoDB bulk write operation fails
 */
export class MongoBulkWriteError extends MongoError {
  constructor(message: string, public writeErrors: unknown[], cause?: unknown) {
    super(message, cause);
    this.name = 'MongoBulkWriteError';
  }
}

/**
 * Error thrown when MongoDB timeout occurs
 */
export class MongoTimeoutError extends MongoError {
  constructor(message: string, public timeoutMs: number, cause?: unknown) {
    super(message, cause);
    this.name = 'MongoTimeoutError';
  }
}

/**
 * Error thrown when MongoDB authentication fails
 */
export class MongoAuthError extends MongoError {
  constructor(message: string, cause?: unknown) {
    super(message, cause);
    this.name = 'MongoAuthError';
  }
}

/**
 * Error thrown when MongoDB schema validation fails
 */
export class MongoSchemaValidationError extends MongoValidationError {
  constructor(message: string, validationErrors: Record<string, string>, public schemaName: string, cause?: unknown) {
    super(message, validationErrors, cause);
    this.name = 'MongoSchemaValidationError';
  }
} 
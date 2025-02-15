/**
 * Base class for MongoDB errors
 */
export class MongoBaseError extends Error {
  constructor(message: string, public cause?: unknown) {
    super(message);
    this.name = this.constructor.name;
  }
}

/**
 * Error thrown when a MongoDB query fails
 */
export class MongoQueryError extends MongoBaseError {
  constructor(message: string, cause?: unknown) {
    super(message, cause);
  }
}

/**
 * Error thrown when a MongoDB write operation fails
 */
export class MongoWriteError extends MongoBaseError {
  constructor(message: string, cause?: unknown) {
    super(message, cause);
  }
}

/**
 * Error thrown when MongoDB validation fails
 */
export class MongoValidationError extends MongoBaseError {
  constructor(message: string, cause?: unknown) {
    super(message, cause);
  }
}

/**
 * Error thrown when MongoDB connection fails
 */
export class MongoConnectionError extends MongoBaseError {
  constructor(message: string, cause?: unknown) {
    super(message, cause);
  }
}

/**
 * Error thrown when MongoDB transaction fails
 */
export class MongoTransactionError extends MongoBaseError {
  constructor(message: string, cause?: unknown) {
    super(message, cause);
  }
}

/**
 * Error thrown when MongoDB duplicate key violation occurs
 */
export class MongoDuplicateKeyError extends MongoBaseError {
  constructor(message: string, public key: string, cause?: unknown) {
    super(message, cause);
  }
}

/**
 * Error thrown when MongoDB bulk write operation fails
 */
export class MongoBulkWriteError extends MongoBaseError {
  constructor(message: string, public writeErrors: unknown[], cause?: unknown) {
    super(message, cause);
  }
}

/**
 * Error thrown when MongoDB timeout occurs
 */
export class MongoTimeoutError extends MongoBaseError {
  constructor(message: string, public timeoutMs: number, cause?: unknown) {
    super(message, cause);
  }
}

/**
 * Error thrown when MongoDB authentication fails
 */
export class MongoAuthError extends MongoBaseError {
  constructor(message: string, cause?: unknown) {
    super(message, cause);
  }
}

/**
 * Error thrown when MongoDB schema validation fails
 */
export class MongoSchemaValidationError extends MongoValidationError {
  constructor(message: string, validationErrors: Record<string, string>, public schemaName: string, cause?: unknown) {
    super(message, cause);
  }
}

export class MongoNotFoundError extends MongoBaseError {
  constructor(message: string, cause?: unknown) {
    super(message, cause);
  }
}

export class MongoDuplicateError extends MongoBaseError {
  constructor(message: string, cause?: unknown) {
    super(message, cause);
  }
} 
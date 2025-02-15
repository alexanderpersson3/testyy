import { AppError } from './errors.js';

/**
 * Base class for validation errors
 */
export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super('VALIDATION_ERROR', message, 400, details);
  }
}

/**
 * Error thrown when a required field is missing
 */
export class RequiredFieldError extends ValidationError {
  constructor(field: string) {
    super(`Required field missing: ${field}`, { field });
  }
}

/**
 * Error thrown when a field has an invalid type
 */
export class InvalidTypeError extends ValidationError {
  constructor(field: string, expectedType: string, receivedType: string) {
    super(
      `Invalid type for field ${field}: expected ${expectedType}, received ${receivedType}`,
      { field, expectedType, receivedType }
    );
  }
}

/**
 * Error thrown when a field value is out of range
 */
export class RangeError extends ValidationError {
  constructor(field: string, min?: number, max?: number) {
    const message = min !== undefined && max !== undefined
      ? `Value for field ${field} must be between ${min} and ${max}`
      : min !== undefined
        ? `Value for field ${field} must be greater than ${min}`
        : `Value for field ${field} must be less than ${max}`;
    super(message, { field, min, max });
  }
}

/**
 * Error thrown when a field value doesn't match a pattern
 */
export class PatternError extends ValidationError {
  constructor(field: string, pattern: string) {
    super(`Value for field ${field} must match pattern: ${pattern}`, { field, pattern });
  }
}

/**
 * Error thrown when a field value is not unique
 */
export class UniqueError extends ValidationError {
  constructor(field: string, value: unknown) {
    super(`Value for field ${field} must be unique`, { field, value });
  }
}

/**
 * Error thrown when a field value is not one of the allowed values
 */
export class EnumError extends ValidationError {
  constructor(field: string, allowedValues: readonly unknown[]) {
    super(
      `Value for field ${field} must be one of: ${allowedValues.join(', ')}`,
      { field, allowedValues }
    );
  }
}

/**
 * Error thrown when a field value is too short
 */
export class MinLengthError extends ValidationError {
  constructor(field: string, minLength: number) {
    super(`Value for field ${field} must be at least ${minLength} characters long`, { field, minLength });
  }
}

/**
 * Error thrown when a field value is too long
 */
export class MaxLengthError extends ValidationError {
  constructor(field: string, maxLength: number) {
    super(`Value for field ${field} must be at most ${maxLength} characters long`, { field, maxLength });
  }
}

/**
 * Error thrown when a field value is not a valid email
 */
export class EmailError extends ValidationError {
  constructor(field: string) {
    super(`Value for field ${field} must be a valid email address`, { field });
  }
}

/**
 * Error thrown when a field value is not a valid URL
 */
export class UrlError extends ValidationError {
  constructor(field: string) {
    super(`Value for field ${field} must be a valid URL`, { field });
  }
}

/**
 * Error thrown when a field value is not a valid date
 */
export class DateError extends ValidationError {
  constructor(field: string) {
    super(`Value for field ${field} must be a valid date`, { field });
  }
}

/**
 * Error thrown when a field value is not a valid ObjectId
 */
export class ObjectIdError extends ValidationError {
  constructor(field: string) {
    super(`Value for field ${field} must be a valid ObjectId`, { field });
  }
}

/**
 * Type guard to check if an error is a validation error
 */
export function isValidationError(error: unknown): error is ValidationError {
  return error instanceof ValidationError;
}

/**
 * Type guard to check if an error is a specific validation error type
 */
export function isValidationErrorType<T extends ValidationError>(
  error: unknown,
  errorType: new (...args: any[]) => T
): error is T {
  return error instanceof errorType;
}

/**
 * Helper to create a validation error from a Zod error
 */
export function fromZodError(error: any): ValidationError {
  if (!error.errors?.length) {
    return new ValidationError('Validation failed');
  }

  const firstError = error.errors[0];
  const field = firstError.path.join('.');
  const message = firstError.message;

  switch (firstError.code) {
    case 'invalid_type':
      return new InvalidTypeError(field, firstError.expected, firstError.received);
    case 'too_small':
      return new MinLengthError(field, firstError.minimum);
    case 'too_big':
      return new MaxLengthError(field, firstError.maximum);
    case 'invalid_string':
      if (firstError.validation === 'email') return new EmailError(field);
      if (firstError.validation === 'url') return new UrlError(field);
      return new PatternError(field, firstError.validation);
    case 'invalid_enum_value':
      return new EnumError(field, firstError.options);
    case 'invalid_date':
      return new DateError(field);
    default:
      return new ValidationError(message, { field });
  }
} 
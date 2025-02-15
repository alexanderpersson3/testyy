export interface ValidationErrorDetail {
  field: string;
  message: string;
}

/**
 * Error thrown when request validation fails
 */
export class ValidationError extends Error {
  public readonly statusCode = 400;
  public readonly errors: ValidationErrorDetail[];

  constructor(message: string, errors: ValidationErrorDetail[]) {
    super(message);
    this.name = 'ValidationError';
    this.errors = errors;
  }
} 
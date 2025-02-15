export interface ValidationErrorDetail {
  field: string;
  message: string;
}

/**
 * Error thrown when request validation fails
 */
export class ValidationError extends Error {
  constructor(
    message: string,
    public field?: string,
    public code: string = 'VALIDATION_ERROR'
  ) {
    super(message);
    this.name = 'ValidationError';
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      field: this.field,
      code: this.code,
    };
  }
} 
/**
 * Base error class for application errors
 */
export class BaseError extends Error {
  constructor(
    message: string,
    public code: string = 'INTERNAL_ERROR',
    public status: number = 500,
    public details?: unknown
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Convert error to JSON format for API responses
   */
  toJSON() {
    return {
      error: {
        code: this.code,
        message: this.message,
        details: this.details,
      },
    };
  }
} 
/**
 * Error thrown when a request is unauthorized
 */
export class UnauthorizedError extends Error {
  public readonly statusCode = 401;

  constructor(message: string) {
    super(message);
    this.name = 'UnauthorizedError';
  }
} 
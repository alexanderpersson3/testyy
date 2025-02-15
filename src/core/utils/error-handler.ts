import type { Recipe } from '../types/express.js';
/**
 * Error handling utilities for consistent error management across the application.
 * Provides a custom error class and error handling functions for operational
 * and programming errors.
 *
 * @module utils/error-handler
 */

/**
 * Custom application error class that extends the built-in Error class.
 * Provides additional context for error handling middleware and client responses.
 *
 * @class AppError
 * @extends Error
 *
 * @property {string} message - Human-readable error message
 * @property {number} statusCode - HTTP status code for the error (default: 500)
 * @property {boolean} isOperational - Whether this is an operational error (default: true)
 *
 * @example
 * // Create a 404 Not Found error
 * throw new AppError('Recipe not found', 404);
 *
 * @example
 * // Create a 403 Forbidden error
 * throw new AppError('Insufficient permissions', 403);
 */
export class AppError extends Error {
  constructor(
    public message: string,
    public statusCode: number = 500,
    public isOperational: boolean = true
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Handles different types of errors and formats them for client response.
 * Distinguishes between operational errors (AppError instances) and programming errors.
 *
 * Operational errors are expected errors that we can handle gracefully:
 * - Invalid user input
 * - Failed validations
 * - Resource not found
 * - Authentication/Authorization failures
 *
 * Programming errors are unexpected and should be logged for investigation:
 * - Database connection failures
 * - Syntax errors
 * - Type errors
 * - Reference errors
 *
 * @param {Error | AppError} err - The error to handle
 * @returns {Object} Formatted error response
 *
 * @example
 * // Handle an operational error
 * const error = new AppError('Invalid password', 400);
 * const response = handleError(error);
 * // => { status: 'error', statusCode: 400, message: 'Invalid password' }
 *
 * @example
 * // Handle a programming error
 * const error = new Error('Database connection failed');
 * const response = handleError(error);
 * // => { status: 'error', statusCode: 500, message: 'Something went wrong' }
 */
export const handleError = (err: Error | AppError) => {
  // Handle known operational errors
  if (err instanceof AppError && err.isOperational) {
    return {
      status: 'error',
      statusCode: err.statusCode,
      message: err.message,
    };
  }

  // Handle programming or unknown errors
  // Log the error for debugging but don't expose details to client
  console.error('ERROR 💥', err);
  return {
    status: 'error',
    statusCode: 500,
    message: 'Something went wrong',
  };
};

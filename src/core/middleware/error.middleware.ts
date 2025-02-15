import { Request, Response, NextFunction } from 'express';
import { BaseError } from '../errors/base.error.js';
import { ValidationError } from '../errors/validation.error.js';
import { MongoError } from '../errors/mongodb.errors.js';
import logger from '../utils/logger.js';

/**
 * Global error handling middleware
 */
export function errorHandler(
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  logger.error('Error:', {
    message: error.message,
    stack: error.stack,
    path: req.path,
    method: req.method,
  });

  // Handle known error types
  if (error instanceof BaseError) {
    res.status(error.status).json(error.toJSON());
    return;
  }

  if (error instanceof ValidationError) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: error.message,
        details: error.details,
      },
    });
    return;
  }

  if (error instanceof MongoError) {
    res.status(500).json({
      error: {
        code: 'DATABASE_ERROR',
        message: 'Database operation failed',
      },
    });
    return;
  }

  // Handle unknown errors
  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
    },
  });
} 
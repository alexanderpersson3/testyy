import { Request, Response, NextFunction } from 'express';
import { MongoBaseError, MongoNotFoundError } from '../core/errors/mongodb.errors';
import { ValidationError } from '../core/errors/validation.error';
import { ZodError } from 'zod';
import logger from '../core/utils/logger';

interface ErrorResponse {
  status: 'error';
  message: string;
  code?: string;
  details?: unknown;
}

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  let statusCode = 500;
  const response: ErrorResponse = {
    status: 'error',
    message: 'Internal server error',
  };

  // Log the error
  logger.error('Error occurred:', {
    error: err,
    path: req.path,
    method: req.method,
    query: req.query,
    body: req.body,
  });

  // Handle different types of errors
  if (err instanceof ValidationError) {
    statusCode = 400;
    response.message = err.message;
    response.code = err.code;
    if (err.field) {
      response.details = { field: err.field };
    }
  } else if (err instanceof ZodError) {
    statusCode = 400;
    response.message = 'Validation error';
    response.code = 'VALIDATION_ERROR';
    response.details = err.errors;
  } else if (err instanceof MongoNotFoundError) {
    statusCode = 404;
    response.message = err.message;
    response.code = 'NOT_FOUND';
  } else if (err instanceof MongoBaseError) {
    statusCode = 500;
    response.message = 'Database error';
    response.code = 'DATABASE_ERROR';
    if (process.env.NODE_ENV === 'development') {
      response.details = err.cause;
    }
  } else if (err instanceof SyntaxError) {
    statusCode = 400;
    response.message = 'Invalid JSON';
    response.code = 'INVALID_JSON';
  } else if (err.name === 'UnauthorizedError') {
    statusCode = 401;
    response.message = 'Authentication required';
    response.code = 'UNAUTHORIZED';
  } else if (err.name === 'ForbiddenError') {
    statusCode = 403;
    response.message = 'Access denied';
    response.code = 'FORBIDDEN';
  }

  // In development, include the stack trace
  if (process.env.NODE_ENV === 'development') {
    response.details = {
      ...response.details,
      stack: err.stack,
    };
  }

  res.status(statusCode).json(response);
}; 
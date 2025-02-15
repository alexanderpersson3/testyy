import { createStructuredLogFunc } from '../config/cloud';
import { isOperationalError, AppError, ValidationError } from '../utils/errors';
import { Request, Response, NextFunction } from 'express';

interface ErrorResponse {
    errorCode: string;
    message: string;
    status: string;
    stack?: string;
    details?: any;
    path: string;
    timestamp: string;
    requestId: string;
}
  
interface ErrorDetails {
    errorCode?: string;
    message: string;
    stack?: string;
    path: string;
    method: string;
    requestId: string;
    userId?: string;
    params: any;
    query: any;
    body: any;
    headers: any;
    timestamp: string;
}

// Error response formatter
const formatError = (err: AppError, req: Request): ErrorResponse => {
  return {
    errorCode: err.errorCode || 'INTERNAL_ERROR',
    message: err.message,
    status: err.status || 'error',
    ...(process.env.NODE_ENV === 'development' && {
      stack: err.stack,
      details: err instanceof ValidationError ? err.errors : undefined,
    }),
    path: req.path,
    timestamp: new Date().toISOString(),
    requestId: (req as any).id,
  };
};

// Log error details
const logError = (err: AppError, req: Request) => {
  const errorDetails: ErrorDetails = {
    errorCode: err.errorCode,
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    requestId: (req as any).id,
    userId: (req as any).userId,
    params: req.params,
    query: req.query,
    body: req.body,
    headers: {
      ...req.headers,
      authorization: undefined, // Don't log auth tokens
    },
    timestamp: new Date().toISOString(),
  };

  // Log operational errors as warnings, others as errors
  const severity = isOperationalError(err) ? 'warning' : 'error';
  createStructuredLogFunc(severity, {
    type: 'request_error',
    ...errorDetails,
  });

  // Additional monitoring for non-operational errors
  if (!isOperationalError(err)) {
    createStructuredLogFunc('critical', {
      type: 'system_error',
      ...errorDetails,
    });
  }
};

// Handle MongoDB errors
const handleMongoError = (err: any) => {
  if (err.code === 11000) {
    return {
      statusCode: 409,
      errorCode: 'DUPLICATE_ERROR',
      message: 'Duplicate field value entered',
    };
  }
  return null;
};

// Handle JWT errors
const handleJWTError = (err: any) => {
  if (err.name === 'JsonWebTokenError') {
    return {
      statusCode: 401,
      errorCode: 'INVALID_TOKEN',
      message: 'Invalid token',
    };
  }
  if (err.name === 'TokenExpiredError') {
    return {
      statusCode: 401,
      errorCode: 'EXPIRED_TOKEN',
      message: 'Token has expired',
    };
  }
  return null;
};

// Handle validation errors
const handleValidationError = (err: any) => {
  if (err.name === 'ValidationError') {
    return {
      statusCode: 400,
      errorCode: 'VALIDATION_ERROR',
      message: 'Invalid input data',
      errors: Object.values(err.errors).map((e: any) => e.message),
    };
  }
  return null;
};

// Main error handling middleware
export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  // Set defaults
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  // Handle specific error types
  const mongoError = handleMongoError(err);
  const jwtError = handleJWTError(err);
  const validationError = handleValidationError(err);

  const handledError = mongoError || jwtError || validationError;
  if (handledError) {
    Object.assign(err, handledError);
  }

  // Log error
  logError(err, req);

  // Send response
  const errorResponse = formatError(err, req);
  res.status(err.statusCode).json({ error: errorResponse });

  // If error is not operational, perform cleanup and notify
  if (!isOperationalError(err)) {
    // Cleanup resources if needed
    // Notify DevOps/SRE team
    createStructuredLogFunc('critical', {
      type: 'non_operational_error',
      error: errorResponse,
      severity: 'critical',
    });
  }
};

// Catch unhandled rejections and exceptions
export const setupErrorHandling = (app: any) => {
    process.on('unhandledRejection', (err: Error) => {
        createStructuredLogFunc('critical', {
          type: 'unhandled_rejection',
          error: err.message,
          stack: err.stack,
        });
        // Give the server time to process existing requests before shutting down
        setTimeout(() => {
          process.exit(1);
        }, 1000);
      });
    
      process.on('uncaughtException', (err: Error) => {
        createStructuredLogFunc('critical', {
          type: 'uncaught_exception',
          error: err.message,
          stack: err.stack,
        });
        // Exit on uncaught exceptions as the application state might be corrupted
        setTimeout(() => {
          process.exit(1);
        }, 1000);
      });

  // Add error handling middleware last
  app.use(errorHandler);
};
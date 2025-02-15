import { createStructuredLog } from '../config/cloud.js';
import { isOperationalError } from '../utils/errors.js';

// Error response formatter
const formatError = (err, req) => {
  return {
    errorCode: err.errorCode || 'INTERNAL_ERROR',
    message: err.message,
    status: err.status || 'error',
    ...(process.env.NODE_ENV === 'development' && {
      stack: err.stack,
      details: err.errors || undefined,
    }),
    path: req.path,
    timestamp: new Date().toISOString(),
    requestId: req.id,
  };
};

// Log error details
const logError = (err, req) => {
  const errorDetails = {
    errorCode: err.errorCode,
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    requestId: req.id,
    userId: req.userId,
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
  createStructuredLog(severity, {
    type: 'request_error',
    ...errorDetails,
  });

  // Additional monitoring for non-operational errors
  if (!isOperationalError(err)) {
    createStructuredLog('critical', {
      type: 'system_error',
      ...errorDetails,
    });
  }
};

// Handle MongoDB errors
const handleMongoError = err => {
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
const handleJWTError = err => {
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
const handleValidationError = err => {
  if (err.name === 'ValidationError') {
    return {
      statusCode: 400,
      errorCode: 'VALIDATION_ERROR',
      message: 'Invalid input data',
      errors: Object.values(err.errors).map(e => e.message),
    };
  }
  return null;
};

// Main error handling middleware
export const errorHandler = (err, req, res, next) => {
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
    createStructuredLog('critical', {
      type: 'non_operational_error',
      error: errorResponse,
      severity: 'critical',
    });
  }
};

// Catch unhandled rejections and exceptions
export const setupErrorHandling = app => {
  process.on('unhandledRejection', err => {
    createStructuredLog('critical', {
      type: 'unhandled_rejection',
      error: err.message,
      stack: err.stack,
    });
    // Give the server time to process existing requests before shutting down
    setTimeout(() => {
      process.exit(1);
    }, 1000);
  });

  process.on('uncaughtException', err => {
    createStructuredLog('critical', {
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

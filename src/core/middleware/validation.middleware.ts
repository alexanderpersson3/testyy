import { ValidationError } from '../types/errors.js';;
import logger from '../utils/logger.js';

/**
 * Middleware to handle validation errors
 */
export function validationMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    // Store original send method
    const originalSend = res.send;

    // Override send method to validate response data
    res.send = function (data: any) {
      try {
        // Validate response data if it's an object
        if (typeof data === 'object' && data !== null) {
          validateResponseData(data);
        }
        
        // Call original send method
        return originalSend.call(this, data);
      } catch (error) {
        logger.error('Response validation error:', error);
        if (error instanceof ValidationError) {
          return res.status(400).json({
            status: 'error',
            code: error.code,
            message: error.message,
            data: error.data
          });
        }
        throw error;
      }
    };

    // Validate request data
    if (req.body && typeof req.body === 'object') {
      validateRequestData(req.body);
    }

    next();
  } catch (error) {
    if (error instanceof ValidationError) {
      return res.status(400).json({
        status: 'error',
        code: error.code,
        message: error.message,
        data: error.data
      });
    }
    next(error);
  }
}

/**
 * Validate request data
 */
function validateRequestData(data: any) {
  // Implement request validation logic
  // This will be called for each request with a body
  Object.entries(data).forEach(([key, value]) => {
    if (value && typeof value === 'object') {
      // Recursively validate nested objects
      validateRequestData(value);
    }
  });
}

/**
 * Validate response data
 */
function validateResponseData(data: any) {
  // Implement response validation logic
  // This will be called before sending any response
  Object.entries(data).forEach(([key, value]) => {
    if (value && typeof value === 'object') {
      // Recursively validate nested objects
      validateResponseData(value);
    }
  });
}

/**
 * Validation error handler middleware
 */
export function validationErrorHandler(
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (error instanceof ValidationError) {
    logger.warn('Validation error:', {
      path: req.path,
      method: req.method,
      error: error.message,
      data: error.data
    });

    return res.status(400).json({
      status: 'error',
      code: error.code,
      message: error.message,
      data: error.data
    });
  }

  next(error);
} 
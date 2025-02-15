import { Request, Response, NextFunction } from 'express';
import { Schema } from 'joi';
import { ValidationError } from '../errors/index.js';

interface ValidationSchema {
  body?: Schema;
  query?: Schema;
  params?: Schema;
}

interface ValidationErrorDetail {
  field: string;
  message: string;
}

/**
 * Request validation middleware using Joi schemas
 */
export function validateRequest(schema: ValidationSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const validationErrors: ValidationErrorDetail[] = [];

    // Validate request body
    if (schema.body) {
      const { error } = schema.body.validate(req.body, { abortEarly: false });
      if (error) {
        error.details.forEach(detail => {
          validationErrors.push({
            field: detail.path.join('.'),
            message: detail.message
          });
        });
      }
    }

    // Validate query parameters
    if (schema.query) {
      const { error } = schema.query.validate(req.query, { abortEarly: false });
      if (error) {
        error.details.forEach(detail => {
          validationErrors.push({
            field: detail.path.join('.'),
            message: detail.message
          });
        });
      }
    }

    // Validate route parameters
    if (schema.params) {
      const { error } = schema.params.validate(req.params, { abortEarly: false });
      if (error) {
        error.details.forEach(detail => {
          validationErrors.push({
            field: detail.path.join('.'),
            message: detail.message
          });
        });
      }
    }

    if (validationErrors.length > 0) {
      next(new ValidationError('Validation failed', validationErrors));
    } else {
      next();
    }
  };
}

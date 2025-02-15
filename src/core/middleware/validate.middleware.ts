import { Request, Response, NextFunction } from 'express';
import { Schema } from 'joi';
import { ValidationError } from '../errors/validation.error.js';

/**
 * Request validation middleware using Joi schemas
 */
export function validateRequest(schema: Schema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { error } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const validationErrors = error.details.map((detail) => ({
        field: detail.path.join('.'),
        message: detail.message,
      }));
      next(new ValidationError('Validation failed', validationErrors));
    } else {
      next();
    }
  };
} 
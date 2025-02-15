import { Schema } from 'joi';

export interface ValidationSchema {
  body?: Schema;
  query?: Schema;
  params?: Schema;
}

export interface ValidationResult {
  isValid: boolean;
  errors?: ValidationError[];
}

export interface ValidationError {
  field: string;
  message: string;
  type?: string;
  context?: Record<string, unknown>;
}

export interface ValidationOptions {
  abortEarly?: boolean;
  allowUnknown?: boolean;
  stripUnknown?: boolean;
  convert?: boolean;
}

export interface ValidatorFunction {
  (value: unknown, options?: ValidationOptions): ValidationResult;
}

export interface AsyncValidatorFunction {
  (value: unknown, options?: ValidationOptions): Promise<ValidationResult>;
} 
import { ObjectId } from 'mongodb';
import { ValidationResult } from '../types/common.types.js';

/**
 * Validation utility functions
 */

/**
 * Validate a MongoDB ObjectId
 */
export function isValidObjectId(id: string): boolean {
  return ObjectId.isValid(id);
}

/**
 * Validate required fields in an object
 */
export function validateRequired<T extends object>(
  data: T,
  requiredFields: (keyof T)[]
): ValidationResult {
  const errors: { [field: string]: string[] } = {};

  for (const field of requiredFields) {
    if (data[field] === undefined || data[field] === null || data[field] === '') {
      errors[field as string] = [`${String(field)} is required`];
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors: Object.keys(errors).length > 0 ? errors : undefined,
  };
}

/**
 * Validate string length
 */
export function validateStringLength(
  value: string,
  options: { min?: number; max?: number }
): ValidationResult {
  const errors: string[] = [];

  if (options.min !== undefined && value.length < options.min) {
    errors.push(`Must be at least ${options.min} characters long`);
  }

  if (options.max !== undefined && value.length > options.max) {
    errors.push(`Must be no more than ${options.max} characters long`);
  }

  return {
    isValid: errors.length === 0,
    errors: errors.length > 0 ? { value: errors } : undefined,
  };
}

/**
 * Validate number range
 */
export function validateNumberRange(
  value: number,
  options: { min?: number; max?: number }
): ValidationResult {
  const errors: string[] = [];

  if (options.min !== undefined && value < options.min) {
    errors.push(`Must be at least ${options.min}`);
  }

  if (options.max !== undefined && value > options.max) {
    errors.push(`Must be no more than ${options.max}`);
  }

  return {
    isValid: errors.length === 0,
    errors: errors.length > 0 ? { value: errors } : undefined,
  };
}

/**
 * Validate array length
 */
export function validateArrayLength<T>(
  array: T[],
  options: { min?: number; max?: number }
): ValidationResult {
  const errors: string[] = [];

  if (options.min !== undefined && array.length < options.min) {
    errors.push(`Must contain at least ${options.min} items`);
  }

  if (options.max !== undefined && array.length > options.max) {
    errors.push(`Must contain no more than ${options.max} items`);
  }

  return {
    isValid: errors.length === 0,
    errors: errors.length > 0 ? { array: errors } : undefined,
  };
}

/**
 * Validate email format
 */
export function validateEmail(email: string): ValidationResult {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const isValid = emailRegex.test(email);

  return {
    isValid,
    errors: isValid ? undefined : { email: ['Invalid email format'] },
  };
}

/**
 * Validate password strength
 */
export function validatePassword(
  password: string,
  options: {
    minLength?: number;
    requireNumbers?: boolean;
    requireSpecialChars?: boolean;
    requireUppercase?: boolean;
    requireLowercase?: boolean;
  } = {}
): ValidationResult {
  const errors: string[] = [];
  const {
    minLength = 8,
    requireNumbers = true,
    requireSpecialChars = true,
    requireUppercase = true,
    requireLowercase = true,
  } = options;

  if (password.length < minLength) {
    errors.push(`Must be at least ${minLength} characters long`);
  }

  if (requireNumbers && !/\d/.test(password)) {
    errors.push('Must contain at least one number');
  }

  if (requireSpecialChars && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push('Must contain at least one special character');
  }

  if (requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('Must contain at least one uppercase letter');
  }

  if (requireLowercase && !/[a-z]/.test(password)) {
    errors.push('Must contain at least one lowercase letter');
  }

  return {
    isValid: errors.length === 0,
    errors: errors.length > 0 ? { password: errors } : undefined,
  };
} 
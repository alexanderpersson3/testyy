export interface ErrorResponse {
  code: string;
  message: string;
  details?: unknown;
  stack?: string;
}

export interface ValidationErrorDetail {
  field: string;
  message: string;
  code?: string;
}

export interface ValidationError extends Error {
  errors: ValidationErrorDetail[];
  status: number;
}

export interface DatabaseError extends Error {
  code: string;
  status: number;
  operation?: string;
  collection?: string;
}

export interface AuthError extends Error {
  code: string;
  status: number;
}

export interface NotFoundError extends Error {
  code: string;
  status: number;
  resource?: string;
}

export type ErrorCode = 
  | 'VALIDATION_ERROR'
  | 'DATABASE_ERROR'
  | 'AUTH_ERROR'
  | 'NOT_FOUND'
  | 'RATE_LIMIT_ERROR'
  | 'INTERNAL_ERROR'; 
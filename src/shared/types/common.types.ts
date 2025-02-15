import { ObjectId } from 'mongodb';

/**
 * Generic pagination parameters
 */
export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * Generic paginated response
 */
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasMore: boolean;
}

/**
 * Generic API response
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

/**
 * Generic filter parameters
 */
export interface FilterParams {
  [key: string]: string | number | boolean | ObjectId | Date | undefined;
}

/**
 * Generic search parameters
 */
export interface SearchParams extends PaginationParams {
  query?: string;
  filters?: FilterParams;
}

/**
 * Generic sort options
 */
export interface SortOptions {
  [key: string]: 1 | -1;
}

/**
 * Generic select options for field selection
 */
export interface SelectOptions {
  [key: string]: 0 | 1;
}

/**
 * Generic cache options
 */
export interface CacheOptions {
  key: string;
  ttl?: number;
  refresh?: boolean;
}

/**
 * Generic validation result
 */
export interface ValidationResult {
  isValid: boolean;
  errors?: {
    [field: string]: string[];
  };
}

/**
 * Generic file upload result
 */
export interface FileUploadResult {
  filename: string;
  path: string;
  mimetype: string;
  size: number;
  url: string;
}

/**
 * Generic geolocation coordinates
 */
export interface GeoCoordinates {
  latitude: number;
  longitude: number;
}

/**
 * Generic date range
 */
export interface DateRange {
  startDate: Date;
  endDate: Date;
} 
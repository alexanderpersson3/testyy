// Common Types
export * from './http.types';
export * from './error.types';
export * from './config.types';
export * from './validation.types';

// Utility Types
export type Nullable<T> = T | null;
export type Optional<T> = T | undefined;
export type AsyncFunction<T = void> = () => Promise<T>;
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

// Response Types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: {
    timestamp: Date;
    duration?: number;
    pagination?: {
      page: number;
      limit: number;
      total: number;
      hasMore: boolean;
    };
  };
}

// Pagination Types
export interface PaginationParams {
  page?: number;
  limit?: number;
  sort?: string;
  order?: 'asc' | 'desc';
}

// Search Types
export interface SearchParams extends PaginationParams {
  query?: string;
  filters?: Record<string, unknown>;
}

// Audit Types
export interface AuditInfo {
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
  updatedBy?: string;
  version?: number;
} 
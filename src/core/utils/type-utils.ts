import { ObjectId } from 'mongodb';;;;
/**
 * Type guard to check if value is ObjectId
 */
export function isObjectId(value: unknown): value is ObjectId {
  return value instanceof ObjectId;
}

/**
 * Convert string or ObjectId to ObjectId
 */
export function toObjectId(id: string | ObjectId): ObjectId {
  return typeof id === 'string' ? new ObjectId(id) : id;
}

/**
 * Convert ObjectId to string
 */
export function toObjectIdString(id: string | ObjectId): string {
  return id instanceof ObjectId ? id.toString() : id;
}

/**
 * Type for route handler callbacks with proper error handling
 */
export type AsyncHandler<T = void> = (
  ...args: any[]
) => Promise<T>;

/**
 * Type for route handler parameters with proper typing
 */
export type RouteParams = {
  [key: string]: string | undefined;
};

/**
 * Type for query parameters with proper typing
 */
export type QueryParams = {
  [key: string]: string | string[] | undefined;
};

/**
 * Helper type to ensure array callbacks have proper typing
 */
export type ArrayCallback<T, R> = (value: T, index: number, array: T[]) => R;

/**
 * Helper type for MongoDB pagination
 */
export interface PaginationParams {
  page?: number;
  limit?: number;
  skip?: number;
}

/**
 * Helper to safely access nested properties
 */
export function safeGet<T, K extends keyof T>(obj: T | null | undefined, key: K): T[K] | undefined {
  return obj?.[key];
}

/**
 * Type guard for non-null values
 */
export function isNonNull<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

/**
 * Helper to ensure array type safety
 */
export function ensureArray<T>(value: T | T[]): T[] {
  return Array.isArray(value) ? value : [value];
}

export function isValidObjectId(id: string): boolean {
  try {
    new ObjectId(id);
    return true;
  } catch {
    return false;
  }
} 
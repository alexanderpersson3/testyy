import { ObjectId } from 'mongodb';
/**
 * Type guard to check if value is ObjectId
 */
export declare function isObjectId(value: unknown): value is ObjectId;
/**
 * Convert string or ObjectId to ObjectId
 */
export declare function toObjectId(id: string | ObjectId): ObjectId;
/**
 * Convert ObjectId to string
 */
export declare function toObjectIdString(id: string | ObjectId): string;
/**
 * Type for route handler callbacks with proper error handling
 */
export type AsyncHandler<T = void> = (...args: any[]) => Promise<T>;
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
export declare function safeGet<T, K extends keyof T>(obj: T | null | undefined, key: K): T[K] | undefined;
/**
 * Type guard for non-null values
 */
export declare function isNonNull<T>(value: T | null | undefined): value is T;
/**
 * Helper to ensure array type safety
 */
export declare function ensureArray<T>(value: T | T[]): T[];
export declare function isValidObjectId(id: string): boolean;

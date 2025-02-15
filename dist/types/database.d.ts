import type { Document, ObjectId } from '../types/index.js';
import { MongoClientOptions, ModifyResult } from 'mongodb';
/**
 * Base interface for all database documents
 */
export interface BaseDocument extends Document {
    _id: ObjectId;
    createdAt: Date;
    updatedAt: Date;
}
/**
 * Type for creating a new document (without _id, createdAt, updatedAt)
 */
export type CreateDocument<T extends BaseDocument> = Omit<T, '_id' | 'createdAt' | 'updatedAt'>;
/**
 * Type for updating an existing document (all fields optional except _id)
 */
export type UpdateDocument<T extends BaseDocument> = Partial<Omit<T, '_id'>> & {
    _id: ObjectId;
};
/**
 * Type for database query filters
 */
export interface QueryFilters {
    [key: string]: any;
}
/**
 * Type for database query options
 */
export interface QueryOptions {
    limit?: number;
    skip?: number;
    sort?: {
        [key: string]: 1 | -1;
    };
}
/**
 * Type for database query result
 */
export interface QueryResult<T extends BaseDocument> {
    items: T[];
    total: number;
    page: number;
    totalPages: number;
    hasMore: boolean;
}
/**
 * Type for database error
 */
export declare class DatabaseError extends Error {
    code?: string | undefined;
    constructor(message: string, code?: string | undefined);
}
/**
 * Type for database connection options
 */
export interface DatabaseOptions {
    uri?: string;
    dbName?: string;
    options?: MongoClientOptions;
}
/**
 * Type for database modify result
 */
export type DatabaseModifyResult<T extends BaseDocument> = ModifyResult<T>;
export type { ModifyResult };

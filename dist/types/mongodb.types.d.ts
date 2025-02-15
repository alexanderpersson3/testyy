import type { ObjectId, Document, WithId, Filter, UpdateFilter } from '../types/index.js';
/**
 * Base document type for all MongoDB documents
 */
export interface BaseDocument {
    _id: ObjectId;
    createdAt: Date;
    updatedAt: Date;
}
/**
 * Type for documents without _id field (for inserts)
 */
export type WithoutId<T> = Omit<T, '_id'>;
/**
 * Type for documents with optional _id field
 */
export type OptionalId<T> = Omit<T, '_id'> & {
    _id?: ObjectId;
};
/**
 * Type for creating new documents
 */
export type CreateDocument<T> = Omit<T, '_id' | 'createdAt' | 'updatedAt'>;
/**
 * Type for updating existing documents
 */
export type UpdateDocument<T> = Partial<Omit<T, '_id' | 'createdAt' | 'updatedAt'>>;
/**
 * Type for MongoDB query result
 */
export type QueryResult<T> = T & {
    _id: ObjectId;
};
/**
 * Type guard to check if a value is an ObjectId
 */
export declare function isObjectId(value: any): value is ObjectId;
/**
 * Type guard to check if a document has an _id
 */
export declare function hasId<T extends Document>(doc: T | WithId<T>): doc is WithId<T>;
/**
 * Convert string to ObjectId
 */
export declare function toObjectId(id: string | ObjectId): ObjectId;
/**
 * Convert array of strings to ObjectIds
 */
export declare function toObjectIds(ids: (string | ObjectId)[]): ObjectId[];
/**
 * Type for MongoDB filter conditions
 */
export type MongoFilter<T> = Filter<T>;
/**
 * Type for MongoDB update operations
 */
export type MongoUpdate<T> = UpdateFilter<T>;

import { ObjectId } from 'mongodb';
import type { Document, WithId, Filter, UpdateFilter, OptionalUnlessRequiredId } from '../types/index.js';
import type { BaseDocument } from '../types/index.js';
/**
 * Converts a string or ObjectId to an ObjectId
 * @param id - String or ObjectId to convert
 * @returns ObjectId instance
 * @throws Error if id is invalid
 */
export declare function toObjectId(id: string | ObjectId): ObjectId;
/**
 * Converts an array of string IDs or ObjectIds to ObjectIds
 * @param ids - Array of string IDs or ObjectIds to convert
 * @returns Array of ObjectIds
 * @throws Error if any id is invalid
 */
export declare function toObjectIds(ids: (string | ObjectId)[]): ObjectId[];
/**
 * Type guard to check if a value is an ObjectId
 * @param value - Value to check
 * @returns True if value is an ObjectId
 */
export declare function isObjectId(value: unknown): value is ObjectId;
/**
 * Type guard to check if a document has an _id field
 * @param doc - Document to check
 * @returns True if document has _id field
 */
export declare function hasId<TSchema extends Document>(doc: TSchema | WithId<TSchema>): doc is WithId<TSchema>;
/**
 * Ensures a document has an _id field
 * @param doc - Document to ensure has _id
 * @returns Document with _id field
 */
export declare function ensureId<TSchema extends Document>(doc: TSchema): WithId<TSchema>;
/**
 * Removes _id field from a document
 */
export declare function withoutId<TSchema extends Document>(doc: WithId<TSchema>): OptionalUnlessRequiredId<TSchema>;
/**
 * Creates a filter for finding a document by ID
 * @param id - ID to filter by
 * @returns Filter object
 */
export declare function byId<TSchema extends Document>(id: string | ObjectId): Filter<TSchema>;
/**
 * Creates a filter for finding documents by multiple IDs
 * @param ids - IDs to filter by
 * @returns Filter object
 */
export declare function byIds<TSchema extends Document>(ids: (string | ObjectId)[]): Filter<TSchema>;
/**
 * Creates an update object with timestamps
 * @param update - Update object
 * @returns Update object with timestamps
 */
export declare function withTimestamp<TSchema extends BaseDocument>(update: Partial<Omit<TSchema, keyof BaseDocument>>): UpdateFilter<TSchema>;
/**
 * Creates a document with timestamps
 * @param doc - Document to add timestamps to
 * @returns Document with timestamps
 */
export declare function withTimestamps<TSchema extends Document>(doc: Omit<TSchema, '_id' | 'createdAt' | 'updatedAt'>): OptionalUnlessRequiredId<TSchema>;
/**
 * Type guard to check if a value is a MongoDB Document
 * @param value - Value to check
 * @returns True if value is a MongoDB Document
 */
export declare function isDocument(value: unknown): value is Document;
/**
 * Type guard to check if a value is a BaseDocument
 * @param value - Value to check
 * @returns True if value is a BaseDocument
 */
export declare function isBaseDocument(value: unknown): value is BaseDocument;
/**
 * Validates that a value is a valid ObjectId string
 * @param value - Value to validate
 * @returns True if value is a valid ObjectId string
 */
export declare function isValidObjectIdString(value: unknown): value is string;
/**
 * Creates a sort object for MongoDB queries
 * @param field - Field to sort by
 * @param order - Sort order (1 for ascending, -1 for descending)
 * @returns Sort object
 */
export declare function createSort<TSchema extends Document>(field: keyof WithId<TSchema>, order?: 1 | -1): {
    [key: string]: 1 | -1;
};
/**
 * Creates a projection object for MongoDB queries
 * @param fields - Fields to include (1) or exclude (0)
 * @returns Projection object
 */
export declare function createProjection<TSchema extends Document>(fields: Partial<Record<keyof WithId<TSchema>, 1 | 0>>): {
    [key: string]: 1 | 0;
};

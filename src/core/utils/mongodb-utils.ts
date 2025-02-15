import { ObjectId } from 'mongodb';;;;
import type { Document, WithId, Filter, UpdateFilter, InferIdType, OptionalUnlessRequiredId } from '../types/express.js';
import type { BaseDocument } from '../types/express.js';

/**
 * Converts a string or ObjectId to an ObjectId
 * @param id - String or ObjectId to convert
 * @returns ObjectId instance
 * @throws Error if id is invalid
 */
export function toObjectId(id: string | ObjectId): ObjectId {
    if (id instanceof ObjectId) return id;
    if (!ObjectId.isValid(id)) {
        throw new Error(`Invalid ObjectId: ${id}`);
    }
    return new ObjectId(id);
}

/**
 * Converts an array of string IDs or ObjectIds to ObjectIds
 * @param ids - Array of string IDs or ObjectIds to convert
 * @returns Array of ObjectIds
 * @throws Error if any id is invalid
 */
export function toObjectIds(ids: (string | ObjectId)[]): ObjectId[] {
    return ids.map(toObjectId);
}

/**
 * Type guard to check if a value is an ObjectId
 * @param value - Value to check
 * @returns True if value is an ObjectId
 */
export function isObjectId(value: unknown): value is ObjectId {
    return value instanceof ObjectId;
}

/**
 * Type guard to check if a document has an _id field
 * @param doc - Document to check
 * @returns True if document has _id field
 */
export function hasId<TSchema extends Document>(
    doc: TSchema | WithId<TSchema>
): doc is WithId<TSchema> {
    return '_id' in doc && isObjectId(doc._id);
}

/**
 * Ensures a document has an _id field
 * @param doc - Document to ensure has _id
 * @returns Document with _id field
 */
export function ensureId<TSchema extends Document>(
    doc: TSchema
): WithId<TSchema> {
    if (!hasId(doc)) {
        return {
            ...doc,
            _id: new ObjectId() as InferIdType<TSchema>
        } as WithId<TSchema>;
    }
    return doc as WithId<TSchema>;
}

/**
 * Removes _id field from a document
 */
export function withoutId<TSchema extends Document>(
    doc: WithId<TSchema>
): OptionalUnlessRequiredId<TSchema> {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { _id, ...rest } = doc;
    return rest as unknown as OptionalUnlessRequiredId<TSchema>;
}

/**
 * Creates a filter for finding a document by ID
 * @param id - ID to filter by
 * @returns Filter object
 */
export function byId<TSchema extends Document>(
    id: string | ObjectId
): Filter<TSchema> {
    return { _id: toObjectId(id) } as unknown as Filter<TSchema>;
}

/**
 * Creates a filter for finding documents by multiple IDs
 * @param ids - IDs to filter by
 * @returns Filter object
 */
export function byIds<TSchema extends Document>(
    ids: (string | ObjectId)[]
): Filter<TSchema> {
    return { _id: { $in: toObjectIds(ids) } } as unknown as Filter<TSchema>;
}

/**
 * Creates an update object with timestamps
 * @param update - Update object
 * @returns Update object with timestamps
 */
export function withTimestamp<TSchema extends BaseDocument>(
    update: Partial<Omit<TSchema, keyof BaseDocument>>
): UpdateFilter<TSchema> {
    return {
        $set: {
            ...update,
            updatedAt: new Date()
        }
    } as UpdateFilter<TSchema>;
}

/**
 * Creates a document with timestamps
 * @param doc - Document to add timestamps to
 * @returns Document with timestamps
 */
export function withTimestamps<TSchema extends Document>(
    doc: Omit<TSchema, '_id' | 'createdAt' | 'updatedAt'>
): OptionalUnlessRequiredId<TSchema> {
    const now = new Date();
    return {
        ...doc,
        createdAt: now,
        updatedAt: now
    } as unknown as OptionalUnlessRequiredId<TSchema>;
}

/**
 * Type guard to check if a value is a MongoDB Document
 * @param value - Value to check
 * @returns True if value is a MongoDB Document
 */
export function isDocument(value: unknown): value is Document {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Type guard to check if a value is a BaseDocument
 * @param value - Value to check
 * @returns True if value is a BaseDocument
 */
export function isBaseDocument(value: unknown): value is BaseDocument {
    return (
        isDocument(value) &&
        hasId(value) &&
        value.createdAt instanceof Date &&
        value.updatedAt instanceof Date
    );
}

/**
 * Validates that a value is a valid ObjectId string
 * @param value - Value to validate
 * @returns True if value is a valid ObjectId string
 */
export function isValidObjectIdString(value: unknown): value is string {
    return typeof value === 'string' && ObjectId.isValid(value);
}

/**
 * Creates a sort object for MongoDB queries
 * @param field - Field to sort by
 * @param order - Sort order (1 for ascending, -1 for descending)
 * @returns Sort object
 */
export function createSort<TSchema extends Document>(
    field: keyof WithId<TSchema>,
    order: 1 | -1 = 1
): { [key: string]: 1 | -1 } {
    return { [field.toString()]: order };
}

/**
 * Creates a projection object for MongoDB queries
 * @param fields - Fields to include (1) or exclude (0)
 * @returns Projection object
 */
export function createProjection<TSchema extends Document>(
    fields: Partial<Record<keyof WithId<TSchema>, 1 | 0>>
): { [key: string]: 1 | 0 } {
    return fields as { [key: string]: 1 | 0 };
} 
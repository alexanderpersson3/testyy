import { ObjectId } from 'mongodb';
;
/**
 * Converts a string or ObjectId to an ObjectId
 * @param id - String or ObjectId to convert
 * @returns ObjectId instance
 * @throws Error if id is invalid
 */
export function toObjectId(id) {
    if (id instanceof ObjectId)
        return id;
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
export function toObjectIds(ids) {
    return ids.map(toObjectId);
}
/**
 * Type guard to check if a value is an ObjectId
 * @param value - Value to check
 * @returns True if value is an ObjectId
 */
export function isObjectId(value) {
    return value instanceof ObjectId;
}
/**
 * Type guard to check if a document has an _id field
 * @param doc - Document to check
 * @returns True if document has _id field
 */
export function hasId(doc) {
    return '_id' in doc && isObjectId(doc._id);
}
/**
 * Ensures a document has an _id field
 * @param doc - Document to ensure has _id
 * @returns Document with _id field
 */
export function ensureId(doc) {
    if (!hasId(doc)) {
        return {
            ...doc,
            _id: new ObjectId()
        };
    }
    return doc;
}
/**
 * Removes _id field from a document
 */
export function withoutId(doc) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { _id, ...rest } = doc;
    return rest;
}
/**
 * Creates a filter for finding a document by ID
 * @param id - ID to filter by
 * @returns Filter object
 */
export function byId(id) {
    return { _id: toObjectId(id) };
}
/**
 * Creates a filter for finding documents by multiple IDs
 * @param ids - IDs to filter by
 * @returns Filter object
 */
export function byIds(ids) {
    return { _id: { $in: toObjectIds(ids) } };
}
/**
 * Creates an update object with timestamps
 * @param update - Update object
 * @returns Update object with timestamps
 */
export function withTimestamp(update) {
    return {
        $set: {
            ...update,
            updatedAt: new Date()
        }
    };
}
/**
 * Creates a document with timestamps
 * @param doc - Document to add timestamps to
 * @returns Document with timestamps
 */
export function withTimestamps(doc) {
    const now = new Date();
    return {
        ...doc,
        createdAt: now,
        updatedAt: now
    };
}
/**
 * Type guard to check if a value is a MongoDB Document
 * @param value - Value to check
 * @returns True if value is a MongoDB Document
 */
export function isDocument(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}
/**
 * Type guard to check if a value is a BaseDocument
 * @param value - Value to check
 * @returns True if value is a BaseDocument
 */
export function isBaseDocument(value) {
    return (isDocument(value) &&
        hasId(value) &&
        value.createdAt instanceof Date &&
        value.updatedAt instanceof Date);
}
/**
 * Validates that a value is a valid ObjectId string
 * @param value - Value to validate
 * @returns True if value is a valid ObjectId string
 */
export function isValidObjectIdString(value) {
    return typeof value === 'string' && ObjectId.isValid(value);
}
/**
 * Creates a sort object for MongoDB queries
 * @param field - Field to sort by
 * @param order - Sort order (1 for ascending, -1 for descending)
 * @returns Sort object
 */
export function createSort(field, order = 1) {
    return { [field.toString()]: order };
}
/**
 * Creates a projection object for MongoDB queries
 * @param fields - Fields to include (1) or exclude (0)
 * @returns Projection object
 */
export function createProjection(fields) {
    return fields;
}
//# sourceMappingURL=mongodb-utils.js.map
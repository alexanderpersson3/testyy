import { ObjectId } from 'mongodb';
;
/**
 * Type guard to check if value is ObjectId
 */
export function isObjectId(value) {
    return value instanceof ObjectId;
}
/**
 * Convert string or ObjectId to ObjectId
 */
export function toObjectId(id) {
    return typeof id === 'string' ? new ObjectId(id) : id;
}
/**
 * Convert ObjectId to string
 */
export function toObjectIdString(id) {
    return id instanceof ObjectId ? id.toString() : id;
}
/**
 * Helper to safely access nested properties
 */
export function safeGet(obj, key) {
    return obj?.[key];
}
/**
 * Type guard for non-null values
 */
export function isNonNull(value) {
    return value !== null && value !== undefined;
}
/**
 * Helper to ensure array type safety
 */
export function ensureArray(value) {
    return Array.isArray(value) ? value : [value];
}
export function isValidObjectId(id) {
    try {
        new ObjectId(id);
        return true;
    }
    catch {
        return false;
    }
}
//# sourceMappingURL=type-utils.js.map
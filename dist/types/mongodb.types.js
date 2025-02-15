/**
 * Type guard to check if a value is an ObjectId
 */
export function isObjectId(value) {
    return value instanceof ObjectId;
}
/**
 * Type guard to check if a document has an _id
 */
export function hasId(doc) {
    return '_id' in doc && isObjectId(doc._id);
}
/**
 * Convert string to ObjectId
 */
export function toObjectId(id) {
    return typeof id === 'string' ? new ObjectId(id) : id;
}
/**
 * Convert array of strings to ObjectIds
 */
export function toObjectIds(ids) {
    return ids.map(toObjectId);
}
//# sourceMappingURL=mongodb.types.js.map
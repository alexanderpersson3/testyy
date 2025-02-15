/**
 * Convert string or ObjectId to ObjectId
 */
export declare function toObjectId(id: string | ObjectId): ObjectId;
/**
 * Convert ObjectId to string
 */
export declare function toString(id: ObjectId | string): string;
/**
 * Check if string is valid ObjectId
 */
export declare function isValidObjectId(id: string): boolean;
/**
 * Convert array of strings to array of ObjectIds
 */
export declare function toObjectIds(ids: (string | ObjectId)[]): ObjectId[];
/**
 * Convert array of ObjectIds to array of strings
 */
export declare function toStrings(ids: (ObjectId | string)[]): string[];

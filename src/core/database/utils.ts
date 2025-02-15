
/**
 * Convert string or ObjectId to ObjectId
 */
export function toObjectId(id: string | ObjectId): ObjectId {
  return typeof id === 'string' ? new ObjectId(id) : id;
}

/**
 * Convert ObjectId to string
 */
export function toString(id: ObjectId | string): string {
  return typeof id === 'string' ? id : id.toString();
}

/**
 * Check if string is valid ObjectId
 */
export function isValidObjectId(id: string): boolean {
  try {
    new ObjectId(id);
    return true;
  } catch {
    return false;
  }
}

/**
 * Convert array of strings to array of ObjectIds
 */
export function toObjectIds(ids: (string | ObjectId)[]): ObjectId[] {
  return ids.map(id => toObjectId(id));
}

/**
 * Convert array of ObjectIds to array of strings
 */
export function toStrings(ids: (ObjectId | string)[]): string[] {
  return ids.map(id => toString(id));
}

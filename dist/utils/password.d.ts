/**
 * Hash a password
 */
export declare function hashPassword(password: string): Promise<string>;
/**
 * Verify a password against a hash
 */
export declare function verifyPassword(password: string, hash: string): Promise<boolean>;

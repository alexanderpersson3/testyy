/**
 * Generate a random string of specified length
 */
export declare function generateRandomString(length: number): string;
/**
 * Generate a random numeric code of specified length
 */
export declare function generateNumericCode(length: number): string;
/**
 * Generate a secure token
 */
export declare function generateToken(length?: number): string;
/**
 * Hash a string using SHA-256
 */
export declare function hashString(str: string): string;
/**
 * Compare a string with its hash
 */
export declare function compareHash(str: string, hash: string): boolean;
/**
 * Generate a random number within a range
 */
export declare function generateRandomNumber(min: number, max: number): number;
/**
 * Generate a secure recovery code
 */
export declare function generateRecoveryCode(): string;
/**
 * Generate a secure verification code
 */
export declare function generateVerificationCode(length?: number): string;

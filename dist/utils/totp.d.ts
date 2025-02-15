/**
 * Generate a new TOTP secret
 */
export declare function generateTOTPSecret(): string;
/**
 * Generate a TOTP code from a secret
 */
export declare function generateTOTP(secret: string): string;
/**
 * Verify a TOTP code against a secret
 */
export declare function verifyTOTP(token: string, secret: string): boolean;
/**
 * Generate a TOTP URI for QR code generation
 */
export declare function generateTOTPUri(secret: string, accountName: string, issuer?: string): string;

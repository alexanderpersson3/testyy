import crypto from 'crypto';

/**
 * Generate a random string of specified length
 */
export function generateRandomString(length: number): string {
  return crypto
    .randomBytes(Math.ceil(length / 2))
    .toString('hex')
    .slice(0, length);
}

/**
 * Generate a random numeric code of specified length
 */
export function generateNumericCode(length: number): string {
  const min = Math.pow(10, length - 1);
  const max = Math.pow(10, length) - 1;

  // Generate random bytes and convert to a number
  const bytes = crypto.randomBytes(4);
  const value = bytes.readUInt32BE(0);

  // Map to our desired range and ensure proper length with padding
  const num = min + (value % (max - min + 1));
  return num.toString().padStart(length, '0');
}

/**
 * Generate a secure token
 */
export function generateToken(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Hash a string using SHA-256
 */
export function hashString(str: string): string {
  return crypto.createHash('sha256').update(str).digest('hex');
}

/**
 * Compare a string with its hash
 */
export function compareHash(str: string, hash: string): boolean {
  const newHash = hashString(str);
  return crypto.timingSafeEqual(Buffer.from(newHash), Buffer.from(hash));
}

/**
 * Generate a random number within a range
 */
export function generateRandomNumber(min: number, max: number): number {
  const range = max - min;
  const bytes = crypto.randomBytes(4);
  const value = bytes.readUInt32BE(0);
  return min + (value % range);
}

/**
 * Generate a secure recovery code
 */
export function generateRecoveryCode(): string {
  return Array.from({ length: 4 }, () => generateRandomString(4).toUpperCase()).join('-');
}

/**
 * Generate a secure verification code
 */
export function generateVerificationCode(length: number = 6): string {
  return generateNumericCode(length);
}

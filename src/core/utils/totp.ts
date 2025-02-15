import { authenticator } from 'otplib';;

/**
 * Generate a new TOTP secret
 */
export function generateTOTPSecret(): string {
  return authenticator.generateSecret();
}

/**
 * Generate a TOTP code from a secret
 */
export function generateTOTP(secret: string): string {
  return authenticator.generate(secret);
}

/**
 * Verify a TOTP code against a secret
 */
export function verifyTOTP(token: string, secret: string): boolean {
  return authenticator.verify({ token, secret });
}

/**
 * Generate a TOTP URI for QR code generation
 */
export function generateTOTPUri(
  secret: string,
  accountName: string,
  issuer: string = 'Rezepta'
): string {
  return authenticator.keyuri(accountName, issuer, secret);
}

import { authenticator } from 'otplib';
/**
 * Generate a new TOTP secret
 */
export function generateTOTPSecret() {
    return authenticator.generateSecret();
}
/**
 * Generate a TOTP code from a secret
 */
export function generateTOTP(secret) {
    return authenticator.generate(secret);
}
/**
 * Verify a TOTP code against a secret
 */
export function verifyTOTP(token, secret) {
    return authenticator.verify({ token, secret });
}
/**
 * Generate a TOTP URI for QR code generation
 */
export function generateTOTPUri(secret, accountName, issuer = 'Rezepta') {
    return authenticator.keyuri(accountName, issuer, secret);
}
//# sourceMappingURL=totp.js.map
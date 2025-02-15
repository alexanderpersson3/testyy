import crypto from 'crypto';
/**
 * Generate a secure random token
 */
export async function generateToken(length = 32) {
    return new Promise((resolve, reject) => {
        crypto.randomBytes(length, (err, buffer) => {
            if (err) {
                reject(err);
            }
            else {
                resolve(buffer.toString('hex'));
            }
        });
    });
}
//# sourceMappingURL=token.js.map
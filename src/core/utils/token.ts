import crypto from 'crypto';

/**
 * Generate a secure random token
 */
export async function generateToken(length: number = 32): Promise<string> {
  return new Promise((resolve: any, reject: any) => {
    crypto.randomBytes(length, (err: any, buffer: any) => {
      if (err) {
        reject(err);
      } else {
        resolve(buffer.toString('hex'));
      }
    });
  });
}

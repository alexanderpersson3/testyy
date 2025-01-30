import jwt from 'jsonwebtoken';
import axios from 'axios';

interface AppleUser {
  sub: string;
  email: string;
  email_verified: boolean;
  name?: string;
}

interface AppleKey {
  kty: string;
  kid: string;
  use: string;
  alg: string;
  n: string;
  e: string;
}

interface AppleKeysResponse {
  keys: AppleKey[];
}

export async function verifyAppleToken(token: string): Promise<AppleUser> {
  try {
    // Get Apple's public keys
    const keysResponse = await axios.get<AppleKeysResponse>('https://appleid.apple.com/auth/keys');
    const keys = keysResponse.data.keys;

    // Verify the token
    const decoded = jwt.decode(token, { complete: true });
    if (!decoded || !decoded.header || !decoded.header.kid) {
      throw new Error('Invalid token format');
    }

    const key = keys.find(k => k.kid === decoded.header.kid);
    if (!key) {
      throw new Error('Invalid key ID');
    }

    // Convert JWK to PEM format
    const modulus = Buffer.from(key.n, 'base64');
    const exponent = Buffer.from(key.e, 'base64');
    const pem = `-----BEGIN PUBLIC KEY-----\n${Buffer.from(
      modulus.toString('base64') + exponent.toString('base64')
    ).toString('base64')}\n-----END PUBLIC KEY-----`;

    const payload = jwt.verify(token, pem, {
      algorithms: ['RS256'],
      audience: process.env.APPLE_CLIENT_ID,
      issuer: 'https://appleid.apple.com'
    }) as jwt.JwtPayload;

    if (!payload.email || !payload.sub) {
      throw new Error('Invalid token payload');
    }

    return {
      sub: payload.sub,
      email: payload.email,
      email_verified: true, // Apple Sign In only provides verified emails
      name: payload.name
    };
  } catch (error) {
    console.error('Apple token verification failed:', error);
    throw new Error('Invalid Apple token');
  }
} 

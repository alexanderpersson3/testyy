import jwt, { SignOptions, Secret } from 'jsonwebtoken';
import { config } from '../../config/index.js';

interface TokenPayload {
  _id: string | { toString(): string };
  role: string;
  [key: string]: unknown;
}

type StringValue = string | undefined;

/**
 * Generate a JWT token
 */
export function generateToken(payload: TokenPayload): string {
  const tokenPayload = {
    _id: payload._id.toString(),
    role: payload.role
  };

  const secret: Secret = process.env.JWT_SECRET || 'test-secret';
  const options: SignOptions = {
    expiresIn: '1d'
  };
  return jwt.sign(tokenPayload, secret, options);
}

/**
 * Verify a JWT token
 */
export function verifyToken(token: string): TokenPayload {
  const secret: Secret = process.env.JWT_SECRET || 'test-secret';
  return jwt.verify(token, secret) as TokenPayload;
}

/**
 * Generate a refresh token
 */
export function generateRefreshToken(payload: TokenPayload): string {
  const tokenPayload = {
    _id: payload._id.toString(),
    role: payload.role,
    type: 'refresh'
  };

  return jwt.sign(tokenPayload, config.auth.jwt.secret, {
    expiresIn: config.auth.jwt.refreshExpiresIn ?? '7d'
  });
}

/**
 * Extract token from Authorization header
 */
export function extractTokenFromHeader(header?: string): string | null {
  if (!header?.startsWith('Bearer ')) {
    return null;
  }
  return header.split(' ')[1];
}

/**
 * Check if a token is expired
 */
export function isTokenExpired(token: string): boolean {
  try {
    const decoded = jwt.decode(token) as { exp?: number };
    if (!decoded.exp) return true;
    return Date.now() >= decoded.exp * 1000;
  } catch {
    return true;
  }
} 
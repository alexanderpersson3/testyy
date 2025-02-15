import bcrypt from 'bcrypt';
import jwt, { SignOptions } from 'jsonwebtoken';
import { User } from '../../modules/users/types/user.types';
import { config } from '../config';

const SALT_ROUNDS = 10;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

interface TokenPayload {
  userId: string;
  email: string;
  role: string;
}

export function generateToken(user: Pick<User, '_id' | 'email' | 'role'>, expiresIn: jwt.SignOptions['expiresIn'] = '1h'): string {
  const payload: TokenPayload = {
    userId: user._id.toString(),
    email: user.email,
    role: user.role
  };
  
  const options: SignOptions = { expiresIn };
  return jwt.sign(payload, config.jwt.secret, options);
}

export function verifyToken(token: string): TokenPayload {
  try {
    return jwt.verify(token, config.jwt.secret) as TokenPayload;
  } catch (error) {
    throw new Error('Invalid token');
  }
}

export function generateRefreshToken(user: Pick<User, '_id'>, expiresIn: jwt.SignOptions['expiresIn'] = '7d'): string {
  const payload = {
    userId: user._id.toString(),
    type: 'refresh'
  };
  
  const options: SignOptions = { expiresIn };
  return jwt.sign(payload, config.jwt.refreshSecret, options);
}

export function verifyRefreshToken(token: string): { userId: string } {
  try {
    const payload = jwt.verify(token, config.jwt.refreshSecret) as { userId: string; type: string };
    if (payload.type !== 'refresh') {
      throw new Error('Invalid refresh token');
    }
    return { userId: payload.userId };
  } catch (error) {
    throw new Error('Invalid refresh token');
  }
} 
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { User } from '../../modules/users/types/user.types';
import { config } from '../../config';
import { ObjectId } from 'mongodb';

const SALT_ROUNDS = 10;

export interface TokenPayload {
  _id: ObjectId;
  role: string;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateToken(payload: TokenPayload): string {
  const tokenPayload = {
    _id: payload._id.toString(),
    role: payload.role
  };
  
  return jwt.sign(tokenPayload, config.jwt.secret);
}

export function verifyToken(token: string): TokenPayload {
  try {
    const decoded = jwt.verify(token, config.jwt.secret) as { _id: string; role: string };
    return {
      _id: new ObjectId(decoded._id),
      role: decoded.role
    };
  } catch (error) {
    throw new Error('Invalid token');
  }
}

export function generateRefreshToken(payload: TokenPayload): string {
  const tokenPayload = {
    _id: payload._id.toString(),
    role: payload.role,
    type: 'refresh'
  };
  
  return jwt.sign(tokenPayload, config.jwt.refreshSecret);
}

export function verifyRefreshToken(token: string): TokenPayload {
  try {
    const decoded = jwt.verify(token, config.jwt.refreshSecret) as { _id: string; role: string; type: string };
    if (decoded.type !== 'refresh') {
      throw new Error('Invalid refresh token');
    }
    return {
      _id: new ObjectId(decoded._id),
      role: decoded.role
    };
  } catch (error) {
    throw new Error('Invalid refresh token');
  }
} 
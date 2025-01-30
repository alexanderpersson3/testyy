import jwt from 'jsonwebtoken';
import { ObjectId } from 'mongodb';

export interface TokenUser {
  id: string;
  email: string;
  role: 'user' | 'admin' | 'moderator';
}

export interface TokenPayload {
  id: string;
  email: string;
  role: 'user' | 'admin' | 'moderator';
}

export function generateToken(user: TokenPayload): string {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role
    },
    process.env.JWT_SECRET!,
    { expiresIn: '24h' }
  );
}

export function verifyToken(token: string): TokenPayload {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as TokenPayload;
    return decoded;
  } catch (error) {
    throw new Error('Invalid token');
  }
}

export function convertToObjectId(id: string | ObjectId): ObjectId {
  return typeof id === 'string' ? new ObjectId(id) : id;
}

export function convertToString(id: string | ObjectId): string {
  return typeof id === 'string' ? id : id.toString();
} 
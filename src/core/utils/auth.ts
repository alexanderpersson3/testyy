import jwt from 'jsonwebtoken';
import { TokenPayload, UserRole } from '../types/auth.js';;

export function generateToken(payload: TokenPayload): string {
  const secret = process.env.JWT_SECRET || 'your-secret-key';
  return jwt.sign(payload, secret);
}

export function verifyToken(token: string): Promise<TokenPayload> {
  return new Promise((resolve: any, reject: any) => {
    try {
      if (!token) {
        reject(new Error('No token provided'));
        return;
      }

      // Remove 'Bearer ' prefix if present
      const cleanToken = token.startsWith('Bearer ') ? token.slice(7) : token;
      
      const secret = process.env.JWT_SECRET || 'your-secret-key';
      const decoded = jwt.verify(cleanToken, secret) as TokenPayload;
      
      if (!decoded || typeof decoded !== 'object') {
        reject(new Error('Invalid token payload'));
        return;
      }

      resolve(decoded);
    } catch (error) {
      reject(error);
    }
  });
}

export function convertToObjectId(id: string | ObjectId): ObjectId {
  return typeof id === 'string' ? new ObjectId(id) : id;
}

export function convertToString(id: string | ObjectId): string {
  return typeof id === 'string' ? id : id.toString();
}

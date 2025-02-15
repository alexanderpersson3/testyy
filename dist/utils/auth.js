import jwt from 'jsonwebtoken';
import { TokenPayload, UserRole } from '../types/auth.js';
export function generateToken(payload) {
    const secret = process.env.JWT_SECRET || 'your-secret-key';
    return jwt.sign(payload, secret);
}
export function verifyToken(token) {
    return new Promise((resolve, reject) => {
        try {
            if (!token) {
                reject(new Error('No token provided'));
                return;
            }
            // Remove 'Bearer ' prefix if present
            const cleanToken = token.startsWith('Bearer ') ? token.slice(7) : token;
            const secret = process.env.JWT_SECRET || 'your-secret-key';
            const decoded = jwt.verify(cleanToken, secret);
            if (!decoded || typeof decoded !== 'object') {
                reject(new Error('Invalid token payload'));
                return;
            }
            resolve(decoded);
        }
        catch (error) {
            reject(error);
        }
    });
}
export function convertToObjectId(id) {
    return typeof id === 'string' ? new ObjectId(id) : id;
}
export function convertToString(id) {
    return typeof id === 'string' ? id : id.toString();
}
//# sourceMappingURL=auth.js.map
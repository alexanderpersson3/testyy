import jwt from 'jsonwebtoken';
import { AppError } from '../utils/error.js';
import { DatabaseService } from '../db/database.service.js';
import { ObjectId } from 'mongodb';
;
import { UserRole } from '../types/auth.js';
class AuthError extends AppError {
    constructor(message) {
        super(message, 401);
    }
}
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    throw new Error('JWT_SECRET environment variable is required');
}
const auth = async (req, res, next) => {
    try {
        const authHeader = req.header('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            throw new AuthError('Invalid authentication header format');
        }
        const token = authHeader.substring(7);
        let decoded;
        try {
            decoded = jwt.verify(token, JWT_SECRET);
        }
        catch (jwtError) {
            throw new AuthError('Invalid authentication token');
        }
        if (!ObjectId.isValid(decoded.id)) {
            throw new AuthError('Invalid user ID in token');
        }
        const db = DatabaseService.getInstance();
        const user = await db.getCollection('users').findOne({
            _id: new ObjectId(decoded.id),
        });
        if (!user) {
            throw new AuthError('User not found');
        }
        req.user = user;
        next();
    }
    catch (error) {
        next(error instanceof Error ? error : new AuthError('Authentication failed'));
    }
};
/**
 * Role-based authorization middleware
 */
const requireRole = (requiredRole) => {
    return async (req, res, next) => {
        try {
            const authReq = req;
            if (!authReq.user) {
                throw new AuthError('Authentication required');
            }
            if (authReq.user.role !== requiredRole) {
                throw new AuthError(`Role ${requiredRole} required`);
            }
            next();
        }
        catch (error) {
            next(error instanceof Error ? error : new AuthError('Authorization failed'));
        }
    };
};
/**
 * Admin authorization middleware
 */
const isAdmin = requireRole(UserRole.ADMIN);
/**
 * Authentication middleware (alias for auth)
 */
const authenticate = auth;
// Export named exports
export { auth, authenticate, requireRole, isAdmin, };
//# sourceMappingURL=auth.js.map
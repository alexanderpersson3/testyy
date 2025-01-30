import { Request } from 'express';
import { ObjectId } from 'mongodb';
import { JwtPayload } from 'jsonwebtoken';
export interface UserDocument {
    _id: ObjectId;
    email: string;
    password: string;
    role: 'user' | 'admin' | 'moderator';
    name?: string;
    createdAt: Date;
    updatedAt: Date;
}
export interface AuthUser {
    _id: ObjectId;
    id: string;
    email: string;
    role: 'user' | 'admin' | 'moderator';
    isAdmin?: boolean;
    hasPremiumAccess?: boolean;
}
export interface AuthenticatedRequest extends Request {
    user?: AuthUser;
}
export interface LoginRequest {
    email: string;
    password: string;
}
export interface RegisterRequest extends LoginRequest {
    name?: string;
}
export interface TokenPayload {
    user: {
        id: string;
        email: string;
        role: 'user' | 'admin' | 'moderator';
    };
}
export interface CustomJwtPayload extends JwtPayload {
    id: string;
    email: string;
    role: 'user' | 'admin' | 'moderator';
    _id?: ObjectId;
}
export declare function convertToObjectId(id: string | ObjectId): ObjectId;
export declare function convertToString(id: string | ObjectId): string;
//# sourceMappingURL=auth.d.ts.map
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
export declare function generateToken(user: TokenPayload): string;
export declare function verifyToken(token: string): TokenPayload;
export declare function convertToObjectId(id: string | ObjectId): ObjectId;
export declare function convertToString(id: string | ObjectId): string;
//# sourceMappingURL=auth.d.ts.map
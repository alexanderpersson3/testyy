import { TokenPayload } from '../types/auth.js';
export declare function generateToken(payload: TokenPayload): string;
export declare function verifyToken(token: string): Promise<TokenPayload>;
export declare function convertToObjectId(id: string | ObjectId): ObjectId;
export declare function convertToString(id: string | ObjectId): string;

import type { Request } from '../types/index.js';
import { ObjectId } from 'mongodb';
import type { BaseUser, UserPreferences } from '../types/index.js';
export declare enum UserRole {
    USER = "user",
    ADMIN = "admin",
    MODERATOR = "moderator",
    PREMIUM = "premium"
}
export interface AuthUser {
    _id: ObjectId;
    id: string;
    email: string;
    name: string;
    role: UserRole;
}
export interface TokenPayload {
    id: string;
    email: string;
    name: string;
    role: UserRole;
    iat?: number;
    exp?: number;
}
export interface AuthenticatedRequest extends Request {
    user?: UserDocument;
}
export interface AuthenticatedUser extends BaseUser {
    _id: ObjectId;
    id: string;
    password: string;
    role: UserRole;
    status: 'active' | 'inactive' | 'banned';
    profile?: {
        name?: string;
        avatar?: string;
        bio?: string;
    };
    preferences?: UserPreferences;
    createdAt: Date;
    updatedAt: Date;
    lastLoginAt?: Date;
}
export interface LoginCredentials {
    email: string;
    password: string;
}
export interface RegisterData {
    email: string;
    password: string;
    name?: string;
}
export interface RefreshTokenPayload {
    id: string;
    version: number;
    iat?: number;
    exp?: number;
}
export interface AuthTokens {
    accessToken: string;
    refreshToken: string;
}
export interface PasswordResetToken {
    _id: ObjectId;
    userId: ObjectId;
    token: string;
    expiresAt: Date;
    used: boolean;
    createdAt: Date;
}
export interface EmailVerificationToken {
    _id: ObjectId;
    userId: ObjectId;
    token: string;
    expiresAt: Date;
    verified: boolean;
    createdAt: Date;
}
export interface SocialProfile {
    provider: 'google' | 'facebook' | 'apple';
    id: string;
    email: string;
    name?: string;
    picture?: string;
}
export interface Session {
    _id: ObjectId;
    userId: ObjectId;
    token: string;
    device: {
        type: string;
        os: string;
        browser: string;
    };
    ip: string;
    createdAt: Date;
    expiresAt: Date;
}
export interface LoginRequest {
    email: string;
    password: string;
}
export interface RegisterRequest {
    email: string;
    password: string;
    name?: string;
}
export interface UserDocument {
    _id: ObjectId;
    id: string;
    email: string;
    password: string;
    name: string;
    role: UserRole;
    preferences?: UserPreferences;
    createdAt: Date;
    updatedAt: Date;
}
export declare function convertToObjectId(id: string | ObjectId): ObjectId;
export declare function convertToString(id: string | ObjectId): string;
export declare function isAuthenticatedRequest(req: Request): req is AuthenticatedRequest;
export type { Request } from 'express';

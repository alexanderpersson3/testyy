import type { Request } from '../types/express.js';
import { ObjectId } from 'mongodb';;;;
import type { BaseUser, UserPreferences } from '../types/express.js';

export enum UserRole {
  USER = 'user',
  ADMIN = 'admin',
  MODERATOR = 'moderator',
  PREMIUM = 'premium',
}

// Core auth types
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

// Extended user types
export interface AuthenticatedUser extends BaseUser {
  _id: ObjectId;
  id: string; // Include both for compatibility
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

// Auth request types
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

// Token types
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

// Social auth types
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

// Request types
export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name?: string;
}

// Database types
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

// Helper functions
export function convertToObjectId(id: string | ObjectId): ObjectId {
  return typeof id === 'string' ? new ObjectId(id) : id;
}

export function convertToString(id: string | ObjectId): string {
  return typeof id === 'string' ? id : id.toString();
}

// Type guards
export function isAuthenticatedRequest(req: Request): req is AuthenticatedRequest {
  return req.user !== undefined && 'id' in req.user;
}

export type { Request } from 'express';

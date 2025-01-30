import { ObjectId } from 'mongodb';

export enum UserRole {
  USER = 'user',
  PREMIUM = 'premium',
  ADMIN = 'admin'
}

export interface UserProfile {
  _id: ObjectId;
  email: string;
  role: UserRole;
  features: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
}

// Type guard for checking if a user has admin role
export const isAdmin = (user: AuthUser): boolean => user.role === UserRole.ADMIN;

// Type guard for checking if a user has premium role
export const isPremium = (user: AuthUser): boolean => 
  user.role === UserRole.PREMIUM || user.role === UserRole.ADMIN;

export interface User {
  _id?: ObjectId;
  email: string;
  name: string;
  password: string;
  role: 'user' | 'admin' | 'moderator';
  isVerified: boolean;
  isPro: boolean;
  invitedBy?: ObjectId;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt?: Date;
  profile?: {
    bio?: string;
    instagramLink?: string;
    facebookLink?: string;
    website?: string;
    highlights?: string[];
  };
  settings?: {
    notifications: {
      email: boolean;
      push: boolean;
      sharedListUpdates: boolean;
      newFollowers: boolean;
      newComments: boolean;
      weeklyDigest: boolean;
    };
    display: {
      theme: 'light' | 'dark' | 'system';
      language: string;
      timezone: string;
    };
  };
} 
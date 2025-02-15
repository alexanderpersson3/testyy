import { ObjectId } from 'mongodb';
import type { MongoDocument } from '../../../core/database/types/mongodb.types.js';

export enum UserRole {
  User = 'user',
  Admin = 'admin',
  Moderator = 'moderator'
}

export enum UserStatus {
  Active = 'active',
  Inactive = 'inactive',
  Suspended = 'suspended',
  Deleted = 'deleted'
}

export interface User extends MongoDocument {
  email: string;
  password: string;
  name: string;
  role: UserRole;
  status: UserStatus;
  avatar?: string;
  bio?: string;
  preferences: {
    language: string;
    theme: 'light' | 'dark';
    emailNotifications: boolean;
    pushNotifications: boolean;
  };
  stats: {
    recipesCreated: number;
    recipesLiked: number;
    commentsPosted: number;
    reputationScore: number;
  };
  social: {
    following: ObjectId[];
    followers: ObjectId[];
  };
  lastLogin?: Date;
  verifiedAt?: Date;
}

export type CreateUserDTO = Omit<User, keyof MongoDocument | 'password'> & {
  password: string;
};

export type UpdateUserDTO = Partial<Omit<User, keyof MongoDocument | 'password' | 'email'>>;

export interface UserProfile {
  _id: ObjectId;
  name: string;
  avatar?: string;
  bio?: string;
  stats: User['stats'];
  social: {
    followingCount: number;
    followersCount: number;
  };
}

export interface UserPreferences extends User['preferences'] {
  userId: ObjectId;
}

export interface UserSession {
  userId: ObjectId;
  token: string;
  device: string;
  ip: string;
  expiresAt: Date;
}

export interface UserActivity extends MongoDocument {
  userId: ObjectId;
  type: 'recipe_created' | 'recipe_liked' | 'comment_posted' | 'user_followed';
  targetId: ObjectId;
  metadata?: Record<string, unknown>;
} 
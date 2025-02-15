import { ObjectId } from 'mongodb';;;;
import { UserRole } from '../auth.js';;
import type { AuthUser } from '../types/express.js';
import type { MongoDocument } from '../types/express.js';
import { Subscription } from '../subscription.js';;

export interface UserPreferences {
  theme: 'light' | 'dark';
  notifications: boolean;
  language: string;
  emailNotifications?: boolean;
  pushNotifications?: boolean;
}

export interface BaseUser {
  email: string;
  name: string;
  role: UserRole;
  avatar?: string;
  preferences?: UserPreferences;
}

export interface User extends BaseUser {
  _id: ObjectId;
  id: string; // Include both for compatibility
  password: string;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt?: Date;
}

export interface UserDocument {
  _id: ObjectId;
  id: string;
  email: string;
  name?: string;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserProfile extends Omit<UserDocument, 'id'>, MongoDocument {
  bio?: string;
  location?: string;
  website?: string;
  avatar?: string | null;
  subscription?: Subscription;
  socialLinks?: {
    instagram?: string;
    twitter?: string;
    facebook?: string;
  };
  preferences: {
    dietary: string[];
    cuisine: string[];
    notifications: {
      email: boolean;
      push: boolean;
      inApp: boolean;
    };
    privacy: {
      profileVisibility: 'public' | 'private' | 'followers';
      recipeVisibility: 'public' | 'private' | 'followers';
      activityVisibility: 'public' | 'private' | 'followers';
    };
  };
  stats: {
    recipesCreated: number;
    recipesLiked: number;
    followers: number;
    following: number;
    totalViews: number;
  };
  following: ObjectId[];
  followers: ObjectId[];
  lastActive?: Date;
  accountStatus: 'active' | 'suspended' | 'deleted';
}

export interface UserStats {
  recipesCreated: number;
  recipesCooked: number;
  favoritesCount: number;
  followersCount: number;
  followingCount: number;
  rating: number;
  contributionScore: number;
}

// Type guards
export const isAdmin = (user: AuthUser): boolean => user.role === UserRole.ADMIN;
export const isPremium = (user: AuthUser): boolean =>
  user.role === UserRole.PREMIUM || user.role === UserRole.ADMIN;

// Input/Update types
export interface UserInput {
  email: string;
  password: string;
  name: string;
  roles?: string[];
  preferences?: {
    theme?: string;
    language?: string;
    notifications?: boolean;
  };
}

export interface UserUpdate {
  email?: string;
  password?: string;
  name?: string;
  roles?: string[];
  preferences?: {
    theme?: string;
    language?: string;
    notifications?: boolean;
  };
}

// Social types
export interface UserFollowing {
  _id?: ObjectId;
  userId: ObjectId;
  followingId: ObjectId;
  createdAt: Date;
}

export interface Activity {
  _id?: ObjectId;
  type: 'follow' | 'like' | 'comment' | 'share' | 'recipe';
  userId: ObjectId;
  targetId: ObjectId;
  metadata?: Record<string, any>;
  createdAt: Date;
}

export interface FollowSuggestion {
  userId: ObjectId;
  username: string;
  displayName: string;
  avatarUrl?: string;
  commonFollowers: number;
  commonInterests: string[];
  lastActive: Date;
  score: number;
}

// Settings
export interface UserSettings {
  theme: 'light' | 'dark';
  notifications: boolean;
  language: string;
  emailNotifications: boolean;
  pushNotifications: boolean;
}

// Re-export auth types
export { UserRole };
export type { AuthUser };

export interface UpdateProfileDTO {
  name?: string;
  bio?: string;
  location?: string;
  website?: string;
  avatar?: string;
  socialLinks?: {
    instagram?: string;
    twitter?: string;
    facebook?: string;
  };
  preferences?: Partial<UserProfile['preferences']>;
}

export interface CreateCollectionDTO {
  name: string;
  description?: string;
  isPrivate?: boolean;
}

export interface GDPRConsentDTO {
  analytics: boolean;
  marketing: boolean;
  thirdParty: boolean;
}

export interface DataExportRequest {
  type: 'profile' | 'recipes' | 'activity' | 'all';
  format: 'json' | 'csv';
}

export interface FollowResponse {
  success: boolean;
  isFollowing: boolean;
  followerCount: number;
}

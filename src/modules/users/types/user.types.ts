import { ObjectId } from 'mongodb';

export enum UserRole {
  Admin = 'admin',
  User = 'user'
}

export enum UserStatus {
  Active = 'active',
  Inactive = 'inactive',
  Suspended = 'suspended'
}

export interface UserPreferences {
  language: string;
  theme: 'light' | 'dark';
  emailNotifications: boolean;
  pushNotifications: boolean;
}

export interface UserStats {
  recipesCreated: number;
  recipesLiked: number;
  commentsPosted: number;
  reputationScore: number;
}

export interface User {
  _id: ObjectId;
  email: string;
  password: string;
  name: string;
  role: UserRole;
  status: UserStatus;
  preferences: UserPreferences;
  stats: UserStats;
  followers: ObjectId[];
  following: ObjectId[];
  createdAt: Date;
  updatedAt: Date;
  verifiedAt?: Date;
}

export type CreateUserDTO = Omit<User, '_id' | 'createdAt' | 'updatedAt' | 'verifiedAt' | 'followers' | 'following'>;
export type UpdateUserDTO = Partial<Omit<User, '_id' | 'email' | 'password' | 'role' | 'createdAt' | 'updatedAt' | 'verifiedAt'>>; 
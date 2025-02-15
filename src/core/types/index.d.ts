import type { Recipe } from '../types/express.js';
import type { Document } from '../types/express.js';
import { Types } from 'mongoose';;
// Common Types
export type ID = string | Types.ObjectId;

export interface PaginationOptions {
  page?: number;
  limit?: number;
}

// User Types
export interface User extends Document {
  email: string;
  password: string;
  name: string;
  role: 'user' | 'admin';
  profile?: {
    bio?: string;
    website?: string;
    location?: string;
    avatar?: string;
    socialLinks?: {
      facebook?: string;
      twitter?: string;
      instagram?: string;
    };
  };
  following: ID[];
  followers: ID[];
  savedRecipes: ID[];
  createdAt: Date;
  lastLogin?: Date;
  isActive: boolean;
  pushToken?: string;
}

// Recipe Types
export interface Recipe extends Document {
  title: string;
  description: string;
  ingredients: {
    name: string;
    amount: number;
    unit: string;
  }[];
  instructions: {
    step: number;
    description: string;
  }[];
  author: ID | User;
  category: 'breakfast' | 'lunch' | 'dinner' | 'dessert' | 'snack';
  preparationTime: number;
  difficulty: 'easy' | 'medium' | 'hard';
  servings: number;
  tags: string[];
  images?: {
    url: string;
    caption?: string;
  }[];
  ratings: {
    user: ID | User;
    score: number;
    comment?: string;
    date: Date;
  }[];
  averageRating: number;
  translations: {
    locale: string;
    title: string;
    description: string;
    instructions: {
      step: number;
      description: string;
    }[];
  }[];
  createdAt: Date;
  updatedAt: Date;
}

// Notification Types
export type NotificationType =
  | 'new_recipe'
  | 'new_comment'
  | 'new_rating'
  | 'price_alert'
  | 'achievement'
  | 'new_follower';

export enum NotificationChannel {
  IN_APP = 'in_app',
  EMAIL = 'email',
  PUSH = 'push',
}

export interface Notification extends Document {
  user: ID | User;
  type: NotificationType;
  data: any;
  channels: NotificationChannel[];
  read: boolean;
  createdAt: Date;
}

// Activity Types
export type ActivityType = 'create_recipe' | 'rate_recipe' | 'comment' | 'follow' | 'achievement';

export interface Activity extends Document {
  user: ID | User;
  type: ActivityType;
  data: any;
  createdAt: Date;
}

// Achievement Types
export interface Achievement extends Document {
  name: string;
  description?: string;
  icon?: string;
  criteria: {
    type: 'recipes_created' | 'ratings_received' | 'followers_count' | 'comments_received';
    threshold: number;
  };
  points: number;
  level: number;
}

export interface UserAchievement extends Document {
  user: ID | User;
  achievement: ID | Achievement;
  unlockedAt: Date;
}

// Service Types
export interface SearchOptions extends PaginationOptions {
  category?: string;
  difficulty?: string;
  minRating?: number;
  maxPrepTime?: number;
  tags?: string[];
  ingredients?: string[];
}

export interface NotificationOptions extends PaginationOptions {
  unreadOnly?: boolean;
  type?: NotificationType;
}

export interface ActivityOptions extends PaginationOptions {
  type?: ActivityType;
}

// Service Response Types
export interface SearchResponse<T> {
  hits: T[];
  total: number;
  page: number;
  pages: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pages: number;
}

// Config Types
export interface Config {
  elasticsearch: {
    url: string;
    username: string;
    password: string;
  };
  mongodb: {
    uri: string;
    options: any;
  };
  redis: {
    url: string;
    options: any;
  };
  jwt: {
    secret: string;
    expiresIn: string;
  };
  email: {
    host: string;
    port: number;
    auth: {
      user: string;
      pass: string;
    };
  };
  push: {
    apiKey: string;
    options: any;
  };
}

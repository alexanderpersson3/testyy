import type { Recipe } from '../types/express.js';
import { ObjectId } from 'mongodb';;;;
import type { MongoDocument } from '../types/express.js';
export type ChallengeType =
  | 'recipe_count'
  | 'cuisine_explorer'
  | 'diet_specialist'
  | 'review_contributor'
  | 'social_butterfly'
  | 'deal_hunter'
  | 'seasonal_chef'
  | 'streak';

export type ChallengeStatus = 'active' | 'completed' | 'expired' | 'failed';
export type BadgeLevel = 'bronze' | 'silver' | 'gold' | 'platinum';

export interface Challenge {
  _id?: ObjectId;
  title: string;
  description: string;
  type: ChallengeType;
  requirements: {
    count?: number;
    cuisineTypes?: string[];
    dietTypes?: string[];
    duration?: number; // in days
    specificRecipes?: ObjectId[];
  };
  rewards: {
    points: number;
    badgeId?: ObjectId;
    unlockFeature?: string;
  };
  startDate: Date;
  endDate: Date;
  isRecurring: boolean;
  recurringInterval?: 'daily' | 'weekly' | 'monthly';
  createdAt: Date;
  updatedAt: Date;
}

export interface ChallengeDocument extends Challenge {
  _id: ObjectId;
}

export interface BaseUserChallenge {
  userId: ObjectId;
  challengeId: ObjectId;
  status: ChallengeStatus;
  progress: number;
  currentStreak?: number;
  bestStreak?: number;
  lastUpdated: Date;
  completedAt?: Date;
  history: Array<{
    date: Date;
    progressDelta: number;
    details?: string;
  }>;
}

export type UserChallenge = BaseUserChallenge;

export interface UserChallengeDocument extends BaseUserChallenge, MongoDocument {}

export interface Badge {
  _id?: ObjectId;
  name: string;
  description: string;
  level: BadgeLevel;
  icon: string;
  category: string;
  requirements: {
    challengeId?: ObjectId;
    achievementCount?: number;
    specificAchievements?: string[];
  };
  unlocksFeature?: string;
  createdAt: Date;
}

export interface BadgeDocument extends Badge {
  _id: ObjectId;
}

export interface UserBadge {
  _id?: ObjectId;
  userId: ObjectId;
  badgeId: ObjectId;
  earnedAt: Date;
  progress?: number;
  level: BadgeLevel;
}

export interface UserBadgeDocument extends UserBadge {
  _id: ObjectId;
}

export interface Achievement {
  _id?: ObjectId;
  userId: ObjectId;
  type: string;
  metadata: {
    recipeId?: ObjectId;
    cuisineType?: string;
    dietType?: string;
    count?: number;
    streak?: number;
  };
  createdAt: Date;
}

export interface AchievementDocument extends Achievement {
  _id: ObjectId;
}

export interface UserAchievementStats {
  userId: ObjectId;
  totalPoints: number;
  badgeCount: {
    total: number;
    bronze: number;
    silver: number;
    gold: number;
    platinum: number;
  };
  completedChallenges: number;
  currentStreaks: {
    daily: number;
    weekly: number;
  };
  bestStreaks: {
    daily: number;
    weekly: number;
  };
  lastUpdated: Date;
}

// Badge type definition
export interface BadgeType {
  type: string;
  levels: BadgeLevel[];
}

// Badge definitions mapping
export interface BadgeDefinitions {
  [key: string]: BadgeType;
}

// User stats interface
export interface UserStats {
  userId: ObjectId;
  recipes_created: number;
  total_likes: number;
  daily_streak: number;
  createdAt: Date;
  updatedAt: Date;
}

// Leaderboard entry interface
export interface LeaderboardEntry {
  userId: string;
  username: string;
  score: number;
  rank: number;
}

// User rank interface
export interface UserRank {
  currentRank: number;
  totalUsers: number;
  score: number;
  nextRank?: {
    score: number;
    remaining: number;
  };
}

// Achievement tracking parameters
export interface TrackAchievementParams {
  userId: string;
  achievementType: string;
  value: number;
}

// Leaderboard options interface
export interface LeaderboardOptions {
  limit?: number;
  offset?: number;
}

export interface UserMetrics {
  recipes_created: number;
  total_likes: number;
  daily_streak: number;
  [key: string]: number;
}

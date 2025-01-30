import { ObjectId } from 'mongodb';
import { Difficulty } from './recipe';

export interface RecipeStats {
  totalRecipes: number;
  avgRating: number;
  totalReviews: number;
  totalLikes: number;
  totalShares: number;
  recipesByDifficulty: {
    easy: number;
    medium: number;
    hard: number;
  };
  topCategories: Array<{
    name: string;
    count: number;
  }>;
  avgPrepTime: number;
  avgCookTime: number;
}

export interface RecipePermissions {
  canView: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canShare: boolean;
  canRate: boolean;
  canComment: boolean;
}

export interface RecipeAnalytics {
  recipeId: ObjectId;
  views: number;
  uniqueViews: number;
  saves: number;
  shares: number;
  printCount: number;
  avgTimeSpent: number; // in seconds
  completionRate: number; // percentage of users who marked recipe as completed
  conversionRate: number; // percentage of viewers who saved/tried the recipe
  byDevice: {
    mobile: number;
    tablet: number;
    desktop: number;
  };
  byCountry: Record<string, number>;
  timeOfDay: {
    morning: number;
    afternoon: number;
    evening: number;
    night: number;
  };
  updatedAt: Date;
} 
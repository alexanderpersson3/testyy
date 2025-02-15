import { z } from 'zod';

// User Profile DTO
export const UserProfileSchema = z.object({
  displayName: z.string().min(2).max(50).optional(),
  bio: z.string().max(500).optional(),
  website: z.string().url().optional().nullable(),
  location: z.string().max(100).optional(),
  avatar: z.string().url().optional(),
  preferences: z.object({
    cuisine: z.array(z.string()).optional(),
    dietaryRestrictions: z.array(z.string()).optional(),
    cookingLevel: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED']).optional(),
    servingSize: z.number().min(1).max(20).optional(),
    measurementSystem: z.enum(['METRIC', 'IMPERIAL']).optional(),
  }).optional(),
});

export type UserProfile = z.infer<typeof UserProfileSchema>;

// User Preferences DTO
export const UserPreferencesSchema = z.object({
  dietaryRestrictions: z.array(z.string()).optional(),
  measurementUnits: z.enum(['metric', 'imperial']).optional(),
  language: z.string().min(2).max(5).optional(),
  notifications: z.object({
    email: z.boolean().optional(),
    push: z.boolean().optional(),
  }).optional(),
  theme: z.enum(['light', 'dark']).optional(),
  privacySettings: z.object({
    privateProfile: z.boolean().optional(),
    showEmail: z.boolean().optional(),
  }).optional(),
});

export type UserPreferences = z.infer<typeof UserPreferencesSchema>;

// User Stats DTO
export interface UserStats {
  recipeCount: number;
  followerCount: number;
  followingCount: number;
  totalLikes: number;
}

// Full User Profile Response DTO
export interface UserProfileResponse {
  _id: string;
  username: string;
  displayName?: string;
  bio?: string;
  website?: string;
  location?: string;
  avatar?: string;
  createdAt: Date;
  preferences?: UserPreferences;
  stats: UserStats;
  isFollowing?: boolean;
} 
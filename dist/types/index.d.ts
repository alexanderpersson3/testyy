import { ObjectId } from 'mongodb';
export declare enum NotificationChannel {
    IN_APP = "in_app",
    EMAIL = "email",
    PUSH = "push",
    SMS = "sms"
}
export type NotificationType = 'recipe_comment' | 'recipe_like' | 'recipe_share' | 'collection_share' | 'cooking_session_invite' | 'cooking_session_update' | 'new_follower' | 'follow_request' | 'follow_accepted' | 'new_story' | 'story_update' | 'story_like' | 'story_comment' | 'performance_alert' | 'security_alert' | 'system_update' | 'security_update' | 'export_completed' | 'export_failed' | 'import_completed' | 'import_failed' | 'new_device';
export type NotificationStatus = 'pending' | 'delivered' | 'sent' | 'failed' | 'read';
export interface Notification {
    _id?: ObjectId;
    userId: ObjectId;
    type: NotificationType;
    title: string;
    message: string;
    data?: Record<string, unknown>;
    read: boolean;
    createdAt: Date;
    updatedAt?: Date;
    channels: NotificationChannel[];
    status: {
        in_app?: NotificationStatus;
        email?: NotificationStatus;
        push?: NotificationStatus;
    };
}
export interface NotificationPreferences {
    _id?: ObjectId;
    userId: ObjectId;
    channels: {
        [key in NotificationType]: NotificationChannel[];
    };
    schedule: {
        digest: boolean;
        digestFrequency: 'daily' | 'weekly';
        digestTime: string;
        quietHours: {
            enabled: boolean;
            start: string;
            end: string;
            timezone: string;
        };
    };
    createdAt: Date;
    updatedAt: Date;
}
export type * from '../auth.js';
export type * from '../scaling.js';
export type * from '../health.js';
export type * from '../import-export.js';
export type * from '../error.types.js';
export type * from '../cache.types.js';
export type * from '../sync.js';
export type * from '../language.js';
export type { Recipe, RecipeInstruction, RecipeComment, RecipeRating, MealPlan as UserMealPlan, Ingredient as RecipeIngredient, NutritionalInfo as RecipeNutritionalInfo, RecipeCollection } from '../recipe.js';
export type { Store as IngredientStore } from '../store.js';
export type { UserSettings as UserProfileSettings, UserPreferences, UserStats } from '../user.js';
export type { Activity, FollowSuggestion, UserFollowing, UserProfile, Comment, Follow } from '../social.js';

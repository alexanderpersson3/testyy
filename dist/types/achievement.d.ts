import { ObjectId } from 'mongodb';
export type ChallengeType = 'recipe_count' | 'cuisine_explorer' | 'diet_specialist' | 'review_contributor' | 'social_butterfly' | 'deal_hunter' | 'seasonal_chef' | 'streak';
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
        duration?: number;
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
export interface UserChallenge {
    _id?: ObjectId;
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
export interface UserChallengeDocument extends UserChallenge {
    _id: ObjectId;
}
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
export interface BadgeType {
    type: string;
    levels: BadgeLevel[];
}
export interface BadgeDefinitions {
    [key: string]: BadgeType;
}
export interface UserStats {
    userId: ObjectId;
    recipes_created: number;
    total_likes: number;
    daily_streak: number;
    createdAt: Date;
    updatedAt: Date;
}
export interface LeaderboardEntry {
    userId: string;
    username: string;
    score: number;
    rank: number;
}
export interface UserRank {
    currentRank: number;
    totalUsers: number;
    score: number;
    nextRank?: {
        score: number;
        remaining: number;
    };
}
export interface TrackAchievementParams {
    userId: string;
    achievementType: string;
    value: number;
}
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
//# sourceMappingURL=achievement.d.ts.map
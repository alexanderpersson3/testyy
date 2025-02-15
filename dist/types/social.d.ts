import { ObjectId } from 'mongodb';
import type { MongoDocument } from '../types/index.js';
export interface SocialStats {
    followers: number;
    following: number;
    likes: number;
    comments: number;
    shares: number;
    totalRecipes: number;
    stories: number;
    totalViews: number;
    popularRecipes: {
        recipeId: ObjectId;
        title: string;
        likes: number;
        shares: number;
        comments: number;
    }[];
    topCollections: {
        collectionId: ObjectId;
        name: string;
        recipeCount: number;
        followers: number;
    }[];
}
export interface BaseUserFollow {
    followerId: ObjectId;
    followedId: ObjectId;
    createdAt: Date;
}
export interface UserFollow extends BaseUserFollow, MongoDocument {
}
export type Follow = UserFollow;
export interface UserFollowDocument extends BaseUserFollow, MongoDocument {
}
export interface ActivityFeedItem {
    _id?: ObjectId;
    userId: ObjectId;
    activityType: ActivityType;
    targetId: ObjectId;
    metadata?: {
        recipeTitle?: string;
        userName?: string;
        collectionName?: string;
        rating?: number;
        review?: string;
        dealDetails?: {
            storeName: string;
            productName: string;
            discount: number;
        };
    };
    createdAt: Date;
}
export interface ActivityFeedDocument extends Omit<ActivityFeedItem, '_id'>, MongoDocument {
}
export interface RecipeWithStats extends MongoDocument {
    title: string;
    likes: number;
    comments: number;
    shares: number;
}
export interface CollectionWithStats extends MongoDocument {
    name: string;
    itemCount: number;
    followers: number;
}
export type ActivityType = 'recipe_created' | 'recipe_liked' | 'recipe_reviewed' | 'recipe_shared' | 'user_followed' | 'collection_created' | 'deal_shared' | 'follow_user' | 'share_recipe' | 'comment_recipe' | 'create_collection' | 'share_story' | 'cooking_session' | 'activity_created' | 'follow' | 'like' | 'comment' | 'share' | 'create_story' | 'create_recipe' | 'join_cooking_session';
export interface BaseStory {
    userId: ObjectId;
    content: string;
    media?: string[];
    likes: number;
    views: number;
    shares: number;
    comments: number;
    tags: string[];
    visibility: 'public' | 'private' | 'followers';
}
export interface Story extends BaseStory, MongoDocument {
    mediaUrls?: string[];
    type: 'text' | 'image' | 'video';
    title?: string;
    description?: string;
    stats: {
        views: number;
        likes: number;
        shares: number;
        comments: number;
    };
    expiresAt: Date;
    isActive: boolean;
    isArchived: boolean;
    isDeleted: boolean;
    lastModified: Date;
}
export interface StoryDocument extends BaseStory, MongoDocument {
}
export interface BaseStoryComment {
    storyId: ObjectId;
    userId: ObjectId;
    content: string;
    likes: number;
}
export interface StoryComment extends BaseStoryComment, MongoDocument {
}
export interface StoryCommentDocument extends BaseStoryComment, MongoDocument {
}
export interface BaseStoryReaction {
    storyId: ObjectId;
    userId: ObjectId;
    type: 'like' | 'love' | 'laugh' | 'sad' | 'angry';
}
export interface StoryReaction extends BaseStoryReaction, MongoDocument {
}
export interface StoryReactionDocument extends BaseStoryReaction, MongoDocument {
}
export interface BaseUserBlock {
    blockerId: ObjectId;
    blockedId: ObjectId;
    reason?: string;
}
export interface UserBlock extends BaseUserBlock, MongoDocument {
}
export interface UserBlockDocument extends BaseUserBlock, MongoDocument {
}
export interface BaseContentReport {
    reporterId: ObjectId;
    contentId: ObjectId;
    contentType: 'story' | 'comment';
    reason: string;
    description?: string;
    status: 'pending' | 'reviewed' | 'resolved';
}
export interface ContentReport extends BaseContentReport, MongoDocument {
}
export interface ContentReportDocument extends BaseContentReport, MongoDocument {
}
export interface BaseStoryShare {
    storyId: ObjectId;
    userId: ObjectId;
    sharedToId?: ObjectId;
    message?: string;
}
export interface StoryShare extends BaseStoryShare, MongoDocument {
}
export interface StoryShareDocument extends BaseStoryShare, MongoDocument {
}
export interface ExploreContent {
    type: 'recipe' | 'profile' | 'story' | 'ad';
    content: any;
    score: number;
}
export interface Achievement extends MongoDocument {
    id: string;
    title: string;
    description: string;
    target: number;
    points: number;
    category: string;
}
export interface AchievementProgress {
    progress: number;
    unlocked: boolean;
    unlockedAt?: Date;
}
export interface UserAchievements {
    score: number;
    progress: {
        [achievementId: string]: AchievementProgress;
    };
}
export interface UserProfile extends MongoDocument {
    userId: ObjectId;
    username: string;
    displayName: string;
    bio?: string;
    avatarUrl?: string;
    coverImageUrl?: string;
    location?: string;
    website?: string;
    socialLinks?: {
        instagram?: string;
        twitter?: string;
        facebook?: string;
        youtube?: string;
    };
    stats: {
        recipesCount: number;
        collectionsCount: number;
        followersCount: number;
        followingCount: number;
        totalLikes: number;
        averageRating: number;
    };
    badges: string[];
    specialties?: string[];
    dietaryPreferences?: string[];
    privacySettings: {
        profileVisibility: 'public' | 'private' | 'followers';
        activityVisibility: 'public' | 'private' | 'followers';
        allowTagging: boolean;
        showCookingSessions: boolean;
        showCollections: boolean;
    };
}
export interface SeasonalChallengeBase {
    participantCount: number;
    completionRate: number;
    startDate: Date;
    endDate: Date;
    status: 'active' | 'completed' | 'cancelled';
    completedAt?: Date;
    title: string;
    description: string;
    target: number;
    points: number;
    category: string;
    type: ChallengeType;
    isRecurring: boolean;
    recurringInterval?: 'daily' | 'weekly' | 'monthly';
}
export interface SeasonalChallenge extends SeasonalChallengeBase, MongoDocument {
}
export interface ChallengeParticipant extends MongoDocument {
    challengeId: ObjectId;
    userId: ObjectId;
    progress: number;
    points: number;
    status: 'active' | 'completed' | 'dropped';
    completedAt?: Date;
}
export interface UserChallenge extends MongoDocument {
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
export interface UserFollowing extends MongoDocument {
    followerId: ObjectId;
    followingId: ObjectId;
}
export interface Comment extends MongoDocument {
    storyId: ObjectId;
    userId: ObjectId;
    content: string;
    likes: number;
}
export interface StoryLike extends MongoDocument {
    storyId: ObjectId;
    userId: ObjectId;
}
export interface StoryView extends MongoDocument {
    storyId: ObjectId;
    userId: ObjectId;
    viewedAt: Date;
}
export interface Activity extends MongoDocument {
    userId: ObjectId;
    type: ActivityType;
    data: Record<string, any>;
}
export interface UserFeed {
    activities: Activity[];
    stories: Story[];
    hasMore: boolean;
    nextCursor?: string;
}
export interface FollowSuggestion {
    userId: ObjectId;
    commonFollowers: number;
    commonInterests: number;
    profile: UserProfile;
}
export type NotificationType = 'new_follower' | 'follow_request' | 'follow_accepted' | 'new_story' | 'story_update' | 'story_like' | 'story_comment';
export type CreateStoryInput = Omit<BaseStory, 'views' | 'likes' | 'shares' | 'comments'>;
export type CreateStoryCommentInput = Omit<BaseStoryComment, 'likes'>;
export type CreateStoryReactionInput = BaseStoryReaction;
export type CreateStoryShareInput = BaseStoryShare;
export type CreateUserBlockInput = BaseUserBlock;
export type CreateContentReportInput = BaseContentReport;
export type CreateUserFollowInput = BaseUserFollow;
export type DocumentWithId<T> = T & {
    _id: ObjectId;
};
export interface UserWithoutSensitiveData extends MongoDocument {
    name: string;
    username: string;
    avatar?: string;
    bio?: string;
    isVerified: boolean;
    isPro: boolean;
}
export type CreateDocument<T> = Omit<T, '_id' | 'createdAt' | 'updatedAt'>;
export type UpdateDocument<T> = Partial<Omit<T, '_id' | 'createdAt'>>;
export type InsertDocument<T extends {
    _id: ObjectId;
}> = T;
export type AggregateResult<T> = {
    [K in keyof T]: T[K] extends ObjectId ? string : T[K];
};

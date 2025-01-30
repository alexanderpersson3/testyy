import { ObjectId } from 'mongodb';
export type ActivityType = 'recipe_created' | 'recipe_liked' | 'recipe_reviewed' | 'recipe_shared' | 'user_followed' | 'collection_created' | 'deal_shared';
export interface BaseUserFollow {
    followerId: ObjectId;
    followedId: ObjectId;
    createdAt: Date;
}
export interface UserFollow extends BaseUserFollow {
    _id?: ObjectId;
}
export interface UserFollowDocument extends BaseUserFollow {
    _id: ObjectId;
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
export interface ActivityFeedDocument extends ActivityFeedItem {
    _id: ObjectId;
}
export interface FeedQueryOptions {
    userId: ObjectId;
    activityTypes?: ActivityType[];
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
}
export interface SocialStats {
    followers: number;
    following: number;
    totalRecipes: number;
    totalReviews: number;
    totalLikes: number;
    totalShares: number;
    popularRecipes: Array<{
        recipeId: ObjectId;
        title: string;
        likes: number;
        shares: number;
    }>;
    topCollections: Array<{
        collectionId: ObjectId;
        name: string;
        recipeCount: number;
        followers: number;
    }>;
}
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
    createdAt: Date;
    updatedAt: Date;
}
export interface Story extends BaseStory {
    _id?: ObjectId;
}
export interface StoryDocument extends BaseStory {
    _id: ObjectId;
}
export interface BaseStoryComment {
    storyId: ObjectId;
    userId: ObjectId;
    content: string;
    likes: number;
    createdAt: Date;
    updatedAt: Date;
}
export interface StoryComment extends BaseStoryComment {
    _id?: ObjectId;
}
export interface StoryCommentDocument extends BaseStoryComment {
    _id: ObjectId;
}
export interface BaseStoryReaction {
    storyId: ObjectId;
    userId: ObjectId;
    type: 'like' | 'love' | 'laugh' | 'sad' | 'angry';
    createdAt: Date;
    updatedAt: Date;
}
export interface StoryReaction extends BaseStoryReaction {
    _id?: ObjectId;
}
export interface StoryReactionDocument extends BaseStoryReaction {
    _id: ObjectId;
}
export interface BaseUserBlock {
    blockerId: ObjectId;
    blockedId: ObjectId;
    reason?: string;
    createdAt: Date;
    updatedAt: Date;
}
export interface UserBlock extends BaseUserBlock {
    _id?: ObjectId;
}
export interface UserBlockDocument extends BaseUserBlock {
    _id: ObjectId;
}
export interface BaseContentReport {
    reporterId: ObjectId;
    contentId: ObjectId;
    contentType: 'story' | 'comment';
    reason: string;
    description?: string;
    status: 'pending' | 'reviewed' | 'resolved';
    createdAt: Date;
    updatedAt: Date;
}
export interface ContentReport extends BaseContentReport {
    _id?: ObjectId;
}
export interface ContentReportDocument extends BaseContentReport {
    _id: ObjectId;
}
export interface BaseStoryShare {
    storyId: ObjectId;
    userId: ObjectId;
    sharedToId?: ObjectId;
    message?: string;
    createdAt: Date;
    updatedAt: Date;
}
export interface StoryShare extends BaseStoryShare {
    _id?: ObjectId;
}
export interface StoryShareDocument extends BaseStoryShare {
    _id: ObjectId;
}
export interface ExploreContent {
    type: 'recipe' | 'profile' | 'story' | 'ad';
    content: any;
    score: number;
}
export type WithId<T> = T & {
    _id: ObjectId;
};
export type WithOptionalId<T> = T & {
    _id?: ObjectId;
};
export type CreateStoryInput = Omit<BaseStory, 'views' | 'likes' | 'shares' | 'comments' | 'createdAt' | 'updatedAt'>;
export type CreateStoryCommentInput = Omit<BaseStoryComment, 'likes' | 'createdAt' | 'updatedAt'>;
export type CreateStoryReactionInput = Omit<BaseStoryReaction, 'createdAt' | 'updatedAt'>;
export type CreateStoryShareInput = Omit<BaseStoryShare, 'createdAt' | 'updatedAt'>;
export type CreateUserBlockInput = Omit<BaseUserBlock, 'createdAt' | 'updatedAt'>;
export type CreateContentReportInput = Omit<BaseContentReport, 'createdAt' | 'updatedAt'>;
export type CreateUserFollowInput = Omit<BaseUserFollow, 'createdAt'>;
export type DocumentWithId<T> = T & {
    _id: ObjectId;
};
export type DocumentWithOptionalId<T> = T & {
    _id?: ObjectId;
};
export interface UserWithoutSensitiveData {
    _id: ObjectId;
    name: string;
    username: string;
    avatar?: string;
    bio?: string;
    isVerified: boolean;
    isPro: boolean;
    createdAt: Date;
    updatedAt: Date;
}
export type CreateDocument<T> = Omit<T, '_id'>;
export type UpdateDocument<T> = Partial<Omit<T, '_id'>>;
export type InsertDocument<T extends {
    _id: ObjectId;
}> = T;
export type AggregateResult<T> = {
    [K in keyof T]: T[K] extends ObjectId ? string : T[K];
};
export type CreateDocumentWithMeta<T extends {
    createdAt: Date;
    updatedAt: Date;
}> = Omit<T, '_id' | 'createdAt' | 'updatedAt'>;
export type InsertDocumentWithMeta<T extends {
    _id: ObjectId;
    createdAt: Date;
    updatedAt: Date;
}> = T;
//# sourceMappingURL=social.d.ts.map
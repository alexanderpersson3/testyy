import type { ObjectId, WithId } from '../types/index.js';
import { UserProfile, Story, FollowSuggestion, SocialStats } from '../types/social.js';
import { DatabaseService } from '../db/database.service.js';
export declare class SocialService {
    private static instance;
    private notificationService;
    private followSuggestionsService;
    private db;
    private constructor();
    static getInstance(db: DatabaseService): SocialService;
    private init;
    updateProfile(userId: ObjectId, updates: Partial<UserProfile>): Promise<void>;
    getProfile(userId: ObjectId): Promise<UserProfile | null>;
    /**
     * Create a story
     */
    createStory(storyData: Omit<Story, '_id' | 'stats' | 'createdAt' | 'expiresAt' | 'isActive' | 'isArchived' | 'isDeleted' | 'lastModified'>): Promise<WithId<Story>>;
    /**
     * Get story by ID
     */
    getStory(storyId: string | ObjectId, viewerId?: string | ObjectId): Promise<WithId<Story> | null>;
    /**
     * Get user's stories
     */
    getUserStories(userId: ObjectId, viewerId?: ObjectId, page?: number, limit?: number): Promise<Story[]>;
    /**
     * Update story
     */
    updateStory(storyId: ObjectId, userId: ObjectId, updates: Partial<Story>): Promise<Story | null>;
    /**
     * Delete story
     */
    deleteStory(storyId: ObjectId, userId: ObjectId): Promise<boolean>;
    followUser(followerId: ObjectId, followedId: ObjectId): Promise<void>;
    /**
     * Unfollow user
     */
    unfollowUser(followerId: ObjectId, followedId: ObjectId): Promise<void>;
    /**
     * Accept follow request
     */
    acceptFollowRequest(userId: ObjectId, followerId: ObjectId): Promise<boolean>;
    /**
     * Get user's followers
     */
    getUserFollowers(userId: ObjectId): Promise<UserProfile[]>;
    /**
     * Get user's following
     */
    getUserFollowing(userId: ObjectId): Promise<UserProfile[]>;
    /**
     * Check if user is following another user
     */
    isFollowing(followerId: ObjectId, followedId: ObjectId): Promise<boolean>;
    /**
     * Notify followers about an event
     */
    private notifyFollowers;
    /**
     * Get follow suggestions
     */
    getFollowSuggestions(userId: string): Promise<FollowSuggestion[]>;
    getSocialStats(userId: ObjectId): Promise<SocialStats>;
    /**
     * Create activity
     */
    private createActivity;
    /**
     * Check if user is blocked
     */
    isUserBlocked(userId: ObjectId, targetId: ObjectId): Promise<boolean>;
}

;
;
import type { Collection } from 'mongodb';
import type { Recipe } from '../types/express.js';
import type { ObjectId, WithId } from '../types/express.js';
import { db } from '../db.js';;
import { ensureConnection } from '../db/connection.js';;
import { NotificationManagerService } from '../notification-manager.service.js';;
import { FollowSuggestionsService } from '../follow-suggestions.service.js';;
import type { RecipeWithStats, CollectionWithStats } from '../types/express.js';
import { UserProfile, Story, StoryComment, StoryReaction, UserBlock, ContentReport, StoryShare, FollowSuggestion, SocialStats, Follow, Activity, ActivityType } from '../types/social.js';;
import logger from '../utils/logger.js';
import type { toObjectId } from '../types/express.js';
import { ensureId } from '../utils/mongodb.js';;
import { DatabaseService } from '../db/database.service.js';;

export class SocialService {
  private static instance: SocialService;
  private notificationService: NotificationManagerService;
  private followSuggestionsService: FollowSuggestionsService;
  private db: DatabaseService;

  private constructor(db: DatabaseService) {
    this.db = db;
    this.notificationService = NotificationManagerService.getInstance();
    this.followSuggestionsService = new FollowSuggestionsService(db);
  }

  static getInstance(db: DatabaseService): SocialService {
    if (!SocialService.instance) {
      SocialService.instance = new SocialService(db);
    }
    return SocialService.instance;
  }

  private async init(): Promise<void> {
    await ensureConnection();
  }

  async updateProfile(userId: ObjectId, updates: Partial<UserProfile>): Promise<void> {
    await this.db
      .getCollection<UserProfile>('user_profiles')
      .updateOne({ userId }, { $set: updates });
  }

  async getProfile(userId: ObjectId): Promise<UserProfile | null> {
    await this.init();
    return await this.db.getCollection<UserProfile>('user_profiles').findOne({ userId });
  }

  /**
   * Create a story
   */
  async createStory(
    storyData: Omit<
      Story,
      | '_id'
      | 'stats'
      | 'createdAt'
      | 'expiresAt'
      | 'isActive'
      | 'isArchived'
      | 'isDeleted'
      | 'lastModified'
    >
  ): Promise<WithId<Story>> {
    await this.init();
    const now = new Date();
    const story = ensureId<Story>({
      ...storyData,
      stats: {
        views: 0,
        likes: 0,
        shares: 0,
        comments: 0,
      },
      createdAt: now,
      expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000), // 24 hours
      isActive: true,
      isArchived: false,
      isDeleted: false,
      lastModified: now,
    } as Story);

    await this.db.getCollection<Story>('stories').insertOne(story);

    // Update user's story count
    await this.db
      .getCollection<UserProfile>('user_profiles')
      .updateOne({ _id: storyData.userId }, { $inc: { storiesCount: 1 } });

    // Notify followers
    await this.notifyFollowers(storyData.userId, 'new_story', {
      storyId: story._id,
    });

    return story;
  }

  /**
   * Get story by ID
   */
  async getStory(
    storyId: string | ObjectId,
    viewerId?: string | ObjectId
  ): Promise<WithId<Story> | null> {
    await this.init();
    const story = await this.db.getCollection<Story>('stories').findOne({
      _id: toObjectId(storyId),
    });

    if (!story) {
      return null;
    }

    // Check if story is active and not deleted
    if (!story.isActive || story.isDeleted) {
      return null;
    }

    // Check if story has expired
    if (story.expiresAt < new Date()) {
      return null;
    }

    // If no viewer, only return public stories
    if (!viewerId) {
      return null;
    }

    // Allow viewing own stories
    if (story.userId.equals(toObjectId(viewerId))) {
      return story;
    }

    // For other users, check if they are a follower
    const isFollowing = await this.isFollowing(toObjectId(viewerId), story.userId);
    if (!isFollowing) {
      return null;
    }

    return story;
  }

  /**
   * Get user's stories
   */
  async getUserStories(
    userId: ObjectId,
    viewerId?: ObjectId,
    page = 1,
    limit = 20
  ): Promise<Story[]> {
    const query: any = { userId };

    // Handle visibility
    if (!viewerId || !viewerId.equals(userId)) {
      if (!viewerId) {
        query.visibility = 'public';
      } else {
        const isFollowing = await this.isFollowing(viewerId, userId);
        query.visibility = isFollowing ? { $in: ['public', 'followers'] } : 'public';
      }
    }

    return await this.db
      .getCollection<Story>('stories')
      .find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .toArray();
  }

  /**
   * Update story
   */
  async updateStory(
    storyId: ObjectId,
    userId: ObjectId,
    updates: Partial<Story>
  ): Promise<Story | null> {
    const story = await this.getStory(storyId);
    if (!story || !story.userId.equals(userId)) {
      return null;
    }

    const allowedUpdates = ['content', 'mediaUrls', 'tags', 'type', 'title', 'description'];
    const filteredUpdates = Object.entries(updates)
      .filter(([key]) => allowedUpdates.includes(key))
      .reduce((obj, [key, value]) => ({ ...obj, [key]: value }), {});

    if (Object.keys(filteredUpdates).length === 0) {
      return story;
    }

    const result = await this.db.getCollection<Story>('stories').findOneAndUpdate(
      { _id: storyId },
      {
        $set: {
          ...filteredUpdates,
          lastModified: new Date(),
        },
      },
      { returnDocument: 'after' }
    );

    return result.value;
  }

  /**
   * Delete story
   */
  async deleteStory(storyId: ObjectId, userId: ObjectId): Promise<boolean> {
    const story = await this.getStory(storyId);
    if (!story || !story.userId.equals(userId)) {
      return false;
    }

    await this.db.getCollection<Story>('stories').deleteOne({ _id: storyId });

    // Update user's story count
    await this.db
      .getCollection<UserProfile>('user_profiles')
      .updateOne({ _id: userId }, { $inc: { storiesCount: -1 } });

    return true;
  }

async followUser(followerId: ObjectId, followedId: ObjectId): Promise<void> {
  const follow = await this.db.getCollection<Follow>('follows').findOne({
    followerId,
    followedId,
  });

  if (follow) {
    throw new Error('Already following user');
  }

  const now = new Date();
  const followDoc: Follow = {
    _id: new ObjectId(),
    followerId,
    followedId,
    createdAt: now,
    updatedAt: now
  };

  await this.db.getCollection<Follow>('follows').insertOne(followDoc);

  await this.createActivity(followerId, 'follow_user', {
    followedId,
  });
}

  /**
   * Unfollow user
   */
  async unfollowUser(followerId: ObjectId, followedId: ObjectId): Promise<void> {
    const result = await this.db.getCollection<Follow>('follows').deleteOne({
      followerId,
      followedId,
    });

    if (result.deletedCount === 0) {
      throw new Error('Not following user');
    }

    await this.createActivity(followerId, 'follow_user', {
      followedId,
      action: 'unfollow',
    });
  }

  /**
   * Accept follow request
   */
  async acceptFollowRequest(userId: ObjectId, followerId: ObjectId): Promise<boolean> {
    const follow = await this.db.getCollection<Follow>('follows').findOne({
      followerId,
      followingId: userId,
      status: 'pending',
    });

    if (!follow) {
      return false;
    }

    await this.db.getCollection<Follow>('follows').updateOne(
      { _id: follow._id },
      {
        $set: {
          status: 'accepted',
          updatedAt: new Date(),
        },
      }
    );

    // Update follower counts
    await Promise.all([
      this.db
        .getCollection<UserProfile>('user_profiles')
        .updateOne({ _id: followerId }, { $inc: { followingCount: 1 } }),
      this.db
        .getCollection<UserProfile>('user_profiles')
        .updateOne({ _id: userId }, { $inc: { followersCount: 1 } }),
    ]);

    // Send notification
    const follower = await this.db
      .getCollection<UserProfile>('user_profiles')
      .findOne({ _id: followerId });
    if (follower) {
      await this.notificationService.sendNotification({
        type: 'follow_accepted',
        userId: followerId,
        title: 'Follow Request Accepted',
        message: `Your follow request was accepted by ${follower.name}`,
        data: {
          followingId: userId,
          followingName: follower.name,
        },
      });
    }

    return true;
  }

  /**
   * Get user's followers
   */
  async getUserFollowers(userId: ObjectId): Promise<UserProfile[]> {
    const follows = await this.db
      .getCollection<Follow>('follows')
      .find({
        followedId: userId,
        status: 'accepted',
      })
      .toArray();

    const followerIds = follows.map((follow: Follow) => follow.followerId);
    return await this.db
      .getCollection<UserProfile>('user_profiles')
      .find({ userId: { $in: followerIds } })
      .toArray();
  }

  /**
   * Get user's following
   */
  async getUserFollowing(userId: ObjectId): Promise<UserProfile[]> {
    const follows = await this.db
      .getCollection<Follow>('follows')
      .find({
        followerId: userId,
        status: 'accepted',
      })
      .toArray();

    const followingIds = follows.map((follow: Follow) => follow.followedId);
    return await this.db
      .getCollection<UserProfile>('user_profiles')
      .find({ userId: { $in: followingIds } })
      .toArray();
  }

  /**
   * Check if user is following another user
   */
  async isFollowing(followerId: ObjectId, followedId: ObjectId): Promise<boolean> {
    const follow = await this.db.getCollection<Follow>('follows').findOne({
      followerId,
      followedId,
    });
    return !!follow;
  }

  /**
   * Notify followers about an event
   */
  private async notifyFollowers(
    userId: ObjectId,
    type: 'new_story' | 'story_update',
    data: Record<string, any>
  ): Promise<void> {
    const follows = await this.db
      .getCollection<Follow>('follows')
      .find({
        followingId: userId,
        status: 'accepted',
      })
      .toArray();

    const user = await this.db.getCollection<UserProfile>('user_profiles').findOne({ _id: userId });
    if (!user) {
      return;
    }

    const notifications = follows.map((follow: Follow) => ({
      type,
      userId: follow.followerId,
      title: type === 'new_story' ? 'New Story' : 'Story Update',
      message: `${user.name} ${type === 'new_story' ? 'shared a new story' : 'updated their story'}`,
      data: {
        ...data,
        userId,
        userName: user.name,
      },
    }));

    await Promise.all(
      notifications.map((notification: any) =>
        this.notificationService.sendNotification(notification)
      )
    );
  }

  /**
   * Get follow suggestions
   */
  async getFollowSuggestions(userId: string): Promise<FollowSuggestion[]> {
    const suggestions = await this.followSuggestionsService.getFollowSuggestions(new ObjectId(userId));
    
    // Transform raw suggestions into FollowSuggestion type
    return suggestions.map(suggestion => ({
      userId: suggestion.userId,
      username: '', // Will be populated from user profile
      displayName: '', // Will be populated from user profile
      commonFollowers: 0,
      commonInterests: 0, // Number of shared interests
      lastActive: new Date(),
      score: suggestion.score,
      profile: {
        _id: suggestion.userId,
        userId: suggestion.userId,
        username: '',
        displayName: '',
        stats: {
          recipesCount: 0,
          collectionsCount: 0,
          followersCount: 0,
          followingCount: 0,
          totalLikes: 0,
          averageRating: 0
        },
        preferences: {
          theme: 'light',
          language: 'en',
          notifications: true
        },
        badges: [],
        privacySettings: {
          profileVisibility: 'public' as const,
          activityVisibility: 'public' as const,
          allowTagging: true,
          showCookingSessions: true,
          showCollections: true
        },
        createdAt: new Date(),
        updatedAt: new Date()
      }
    }));
  }

async getSocialStats(userId: ObjectId): Promise<SocialStats> {
    const popularRecipes = await this.db
      .getCollection<RecipeWithStats>('recipes')
      .find({ userId })
      .sort({ likes: -1, shares: -1, comments: -1 })
      .limit(5)
      .toArray();

    const topCollections = await this.db
      .getCollection<CollectionWithStats>('collections')
      .find({ userId })
      .sort({ followers: -1 })
      .limit(5)
      .toArray();

    const [followers, following, recipes, collections, stories, likes, shares, reviews, views] =
      await Promise.all([
        this.db.getCollection<Follow>('follows').countDocuments({ followedId: userId, status: 'accepted' }),
        this.db.getCollection<Follow>('follows').countDocuments({ followerId: userId, status: 'accepted' }),
        this.db.getCollection<RecipeWithStats>('recipes').countDocuments({ userId }),
        this.db.getCollection<CollectionWithStats>('collections').countDocuments({ userId }),
        this.db.getCollection<Story>('stories').countDocuments({ userId }),
        this.db.getCollection('recipe_likes').countDocuments({ recipeId: { $in: popularRecipes.map(r => r._id) } }),
        this.db.getCollection('recipe_shares').countDocuments({ recipeId: { $in: popularRecipes.map(r => r._id) } }),
        this.db.getCollection('recipe_reviews').countDocuments({ recipeId: { $in: popularRecipes.map(r => r._id) } }),
        this.db.getCollection('recipe_views').countDocuments({ recipeId: { $in: popularRecipes.map(r => r._id) } }),
      ]);

    return {
      followers,
      following,
      totalRecipes: recipes,
      comments: reviews,
      likes,
      shares,
      stories,
      totalViews: views,
      popularRecipes: popularRecipes.map(recipe => ({
        recipeId: recipe._id,
        title: recipe.title,
        likes: recipe.likes,
        shares: recipe.shares,
        comments: recipe.comments,
      })),
      topCollections: topCollections.map(collection => ({
        collectionId: collection._id,
        name: collection.name,
        recipeCount: collection.itemCount || 0,
        followers: collection.followers,
      })),
    };
  }

  /**
   * Create activity
   */
  private async createActivity(
    userId: ObjectId,
    type: ActivityType,
    data: Record<string, any>
  ): Promise<void> {
    await this.init();
    const activity = ensureId<Activity>({
      userId,
      type,
      data,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as Activity);

    await this.db.getCollection<Activity>('activities').insertOne(activity);
  }

  /**
   * Check if user is blocked
   */
  async isUserBlocked(userId: ObjectId, targetId: ObjectId): Promise<boolean> {
    await this.init();
    const blocks = await this.db.getCollection<UserBlock>('user_blocks')
      .find({
        $or: [
          { blockerId: userId, blockedId: targetId },
          { blockerId: targetId, blockedId: userId },
        ],
      })
      .toArray();

    return blocks.length > 0;
  }
}

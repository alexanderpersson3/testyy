import { ObjectId } from 'mongodb';
import { 
  UserFollowDocument,
  StoryDocument,
  StoryCommentDocument,
  StoryReactionDocument,
  StoryShareDocument,
  UserBlockDocument,
  ContentReportDocument,
  CreateStoryInput,
  CreateStoryCommentInput,
  CreateStoryReactionInput,
  CreateStoryShareInput,
  CreateUserBlockInput,
  CreateContentReportInput,
  CreateUserFollowInput,
  UserWithoutSensitiveData,
  WithId,
  ExploreContent,
  InsertDocumentWithMeta
} from '../types/social';
import { User } from '../types/user';
import { UserProfile, UserProfileDocument } from '../types/profile';
import { Collection, Db } from 'mongodb';

export class SocialService {
  private storiesCollection: Collection<StoryDocument>;
  private followsCollection: Collection<UserFollowDocument>;
  private profilesCollection: Collection<UserProfileDocument>;
  private usersCollection: Collection<User>;
  private commentsCollection: Collection<StoryCommentDocument>;
  private reactionsCollection: Collection<StoryReactionDocument>;
  private blocksCollection: Collection<UserBlockDocument>;
  private reportsCollection: Collection<ContentReportDocument>;
  private sharesCollection: Collection<StoryShareDocument>;

  constructor(db: Db) {
    this.storiesCollection = db.collection('stories');
    this.followsCollection = db.collection('follows');
    this.profilesCollection = db.collection('profiles');
    this.usersCollection = db.collection('users');
    this.commentsCollection = db.collection('comments');
    this.reactionsCollection = db.collection('reactions');
    this.blocksCollection = db.collection('blocks');
    this.reportsCollection = db.collection('reports');
    this.sharesCollection = db.collection('shares');
  }

  // Profile Management
  async getProfile(userId: ObjectId): Promise<UserProfileDocument | null> {
    return this.profilesCollection.findOne({ userId });
  }

  async updateProfile(userId: ObjectId, updates: Partial<UserProfileDocument>): Promise<boolean> {
    const result = await this.profilesCollection.updateOne(
      { userId },
      { 
        $set: {
          ...updates,
          updatedAt: new Date()
        }
      },
      { upsert: true }
    );
    return result.acknowledged;
  }

  async addHighlight(userId: ObjectId, highlight: Omit<UserProfileDocument['highlights'][0], '_id' | 'createdAt'>): Promise<ObjectId | null> {
    const highlightWithMeta = {
      ...highlight,
      _id: new ObjectId(),
      createdAt: new Date()
    };

    const result = await this.profilesCollection.updateOne(
      { userId },
      { 
        $push: { highlights: highlightWithMeta as any },
        $set: { updatedAt: new Date() }
      }
    );

    return result.modifiedCount > 0 ? highlightWithMeta._id : null;
  }

  async removeHighlight(userId: ObjectId, highlightId: ObjectId): Promise<boolean> {
    const result = await this.profilesCollection.updateOne(
      { userId },
      { 
        $pull: { highlights: { _id: highlightId } as any },
        $set: { updatedAt: new Date() }
      }
    );
    return result.modifiedCount > 0;
  }

  // Follow System
  async followUser(followerId: ObjectId, followedId: ObjectId): Promise<boolean> {
    // Check if already following
    const existing = await this.followsCollection.findOne({
      followerId,
      followedId
    });

    if (existing) {
      return false;
    }

    const follow: UserFollowDocument = {
      _id: new ObjectId(),
      followerId,
      followedId,
      createdAt: new Date()
    };

    const [followResult] = await Promise.all([
      this.followsCollection.insertOne(follow),
      this.profilesCollection.updateOne(
        { userId: followerId },
        { $inc: { 'stats.following': 1 } }
      ),
      this.profilesCollection.updateOne(
        { userId: followedId },
        { $inc: { 'stats.followers': 1 } }
      )
    ]);

    return followResult.acknowledged;
  }

  async unfollowUser(followerId: ObjectId, followedId: ObjectId): Promise<boolean> {
    const result = await this.followsCollection.deleteOne({
      followerId,
      followedId
    });

    if (result.deletedCount > 0) {
      await Promise.all([
        this.profilesCollection.updateOne(
          { userId: followerId },
          { $inc: { 'stats.following': -1 } }
        ),
        this.profilesCollection.updateOne(
          { userId: followedId },
          { $inc: { 'stats.followers': -1 } }
        )
      ]);
      return true;
    }

    return false;
  }

  async getFollowers(userId: ObjectId): Promise<WithId<UserFollowDocument>[]> {
    return this.followsCollection
      .find({ followedId: userId })
      .toArray();
  }

  async getFollowing(userId: ObjectId): Promise<WithId<UserFollowDocument>[]> {
    return this.followsCollection
      .find({ followerId: userId })
      .toArray();
  }

  // Stories
  async createStory(input: CreateStoryInput): Promise<ObjectId | null> {
    const story: StoryDocument = {
      _id: new ObjectId(),
      ...input,
      likes: 0,
      views: 0,
      shares: 0,
      comments: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    const result = await this.storiesCollection.insertOne(story);
    return result.insertedId;
  }

  async createStoryComment(input: CreateStoryCommentInput): Promise<ObjectId | null> {
    const comment: StoryCommentDocument = {
      _id: new ObjectId(),
      ...input,
      likes: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    const result = await this.commentsCollection.insertOne(comment);
    return result.insertedId;
  }

  async createStoryReaction(input: CreateStoryReactionInput): Promise<ObjectId | null> {
    const reaction: StoryReactionDocument = {
      _id: new ObjectId(),
      ...input,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    const result = await this.reactionsCollection.insertOne(reaction);
    return result.insertedId;
  }

  async createStoryShare(input: CreateStoryShareInput): Promise<ObjectId | null> {
    const share: StoryShareDocument = {
      _id: new ObjectId(),
      ...input,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    const result = await this.sharesCollection.insertOne(share);
    return result.insertedId;
  }

  async createUserBlock(input: CreateUserBlockInput): Promise<ObjectId | null> {
    const block: UserBlockDocument = {
      _id: new ObjectId(),
      ...input,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    const result = await this.blocksCollection.insertOne(block);
    return result.insertedId;
  }

  async createContentReport(input: CreateContentReportInput): Promise<ObjectId | null> {
    const report: ContentReportDocument = {
      _id: new ObjectId(),
      ...input,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    const result = await this.reportsCollection.insertOne(report);
    return result.insertedId;
  }

  async createUserFollow(input: CreateUserFollowInput): Promise<ObjectId | null> {
    const follow: UserFollowDocument = {
      _id: new ObjectId(),
      ...input,
      createdAt: new Date()
    };
    
    const result = await this.followsCollection.insertOne(follow);
    return result.insertedId;
  }

  async getStories(userId: ObjectId): Promise<WithId<StoryDocument>[]> {
    return this.storiesCollection
      .find({ userId })
      .sort({ createdAt: -1 })
      .toArray();
  }

  async viewStory(storyId: ObjectId): Promise<boolean> {
    const result = await this.storiesCollection.updateOne(
      { _id: storyId },
      { 
        $inc: { views: 1 },
        $set: { updatedAt: new Date() }
      }
    );
    return result.modifiedCount > 0;
  }

  // Explore Feed
  async getExploreFeed(userId: ObjectId, page: number = 1, limit: number = 20): Promise<StoryDocument[]> {
    const skip = (page - 1) * limit;
    
    return this.storiesCollection
      .find({
        userId: { $ne: userId },
        visibility: 'public'
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();
  }

  // Popular Users
  async getPopularUsers(limit: number = 10): Promise<UserProfileDocument[]> {
    return this.profilesCollection
      .find()
      .sort({ 'stats.followers': -1 })
      .limit(limit)
      .toArray();
  }

  // User Stats
  async updateUserStats(userId: ObjectId, updates: Partial<UserProfileDocument['stats']>): Promise<boolean> {
    const result = await this.profilesCollection.updateOne(
      { userId },
      { 
        $inc: updates,
        $set: { updatedAt: new Date() }
      }
    );
    return result.modifiedCount > 0;
  }

  // Comments
  async addComment(storyId: ObjectId, userId: ObjectId, content: string): Promise<ObjectId | null> {
    const now = new Date();
    const comment: StoryCommentDocument = {
      _id: new ObjectId(),
      storyId,
      userId,
      content,
      likes: 0,
      createdAt: now,
      updatedAt: now
    };

    const result = await this.commentsCollection.insertOne(comment);
    return result.acknowledged ? result.insertedId : null;
  }

  async getStoryComments(storyId: ObjectId): Promise<WithId<StoryCommentDocument>[]> {
    return this.commentsCollection
      .find<WithId<StoryCommentDocument>>({ storyId })
      .sort({ createdAt: -1 })
      .toArray();
  }

  // Reactions
  async addReaction(storyId: ObjectId, userId: ObjectId, type: StoryReactionDocument['type']): Promise<boolean> {
    // Remove any existing reaction from this user
    await this.reactionsCollection.deleteOne({ storyId, userId });

    const now = new Date();
    const reaction: StoryReactionDocument = {
      _id: new ObjectId(),
      storyId,
      userId,
      type,
      createdAt: now,
      updatedAt: now
    };

    const result = await this.reactionsCollection.insertOne(reaction);
    return result.acknowledged;
  }

  async removeReaction(storyId: ObjectId, userId: ObjectId): Promise<boolean> {
    const result = await this.reactionsCollection.deleteOne({ storyId, userId });
    return result.deletedCount > 0;
  }

  async getStoryReactions(storyId: ObjectId): Promise<WithId<StoryReactionDocument>[]> {
    return this.reactionsCollection
      .find<WithId<StoryReactionDocument>>({ storyId })
      .sort({ createdAt: -1 })
      .toArray();
  }

  // Story Sharing
  async shareStory(storyId: ObjectId, userId: ObjectId, sharedToId?: ObjectId, message?: string): Promise<ObjectId | null> {
    const now = new Date();
    const share: StoryShareDocument = {
      _id: new ObjectId(),
      storyId,
      userId,
      sharedToId,
      message,
      createdAt: now,
      updatedAt: now
    };

    const result = await this.sharesCollection.insertOne(share);
    return result.acknowledged ? result.insertedId : null;
  }

  async getStoryShares(storyId: ObjectId): Promise<WithId<StoryShareDocument>[]> {
    return this.sharesCollection
      .find<WithId<StoryShareDocument>>({ storyId })
      .sort({ createdAt: -1 })
      .toArray();
  }

  // User Blocking
  async blockUser(blockerId: ObjectId, blockedId: ObjectId, reason?: string): Promise<boolean> {
    // Check if already blocked
    const existing = await this.blocksCollection.findOne({
      blockerId,
      blockedId
    });

    if (existing) {
      return false;
    }

    const now = new Date();
    const block: UserBlockDocument = {
      _id: new ObjectId(),
      blockerId,
      blockedId,
      reason,
      createdAt: now,
      updatedAt: now
    };

    // Remove any existing follows
    await Promise.all([
      this.followsCollection.deleteOne({
        followerId: blockerId,
        followedId: blockedId
      }),
      this.followsCollection.deleteOne({
        followerId: blockedId,
        followedId: blockerId
      })
    ]);

    const result = await this.blocksCollection.insertOne(block);
    return result.acknowledged;
  }

  async unblockUser(blockerId: ObjectId, blockedId: ObjectId): Promise<boolean> {
    const result = await this.blocksCollection.deleteOne({
      blockerId,
      blockedId
    });
    return result.deletedCount > 0;
  }

  async getUserBlocks(userId: ObjectId): Promise<WithId<UserBlockDocument>[]> {
    return this.blocksCollection
      .find<WithId<UserBlockDocument>>({ blockerId: userId })
      .sort({ createdAt: -1 })
      .toArray();
  }

  // Content Reporting
  async reportContent(
    reporterId: ObjectId,
    contentType: ContentReportDocument['contentType'],
    contentId: ObjectId,
    reason: ContentReportDocument['reason'],
    description?: string
  ): Promise<ObjectId | null> {
    const now = new Date();
    const report: ContentReportDocument = {
      _id: new ObjectId(),
      reporterId,
      contentType,
      contentId,
      reason,
      description,
      status: 'pending',
      createdAt: now,
      updatedAt: now
    };

    const result = await this.reportsCollection.insertOne(report);
    return result.acknowledged ? result.insertedId : null;
  }

  async updateReportStatus(reportId: ObjectId, status: ContentReportDocument['status']): Promise<boolean> {
    const result = await this.reportsCollection.updateOne(
      { _id: reportId },
      {
        $set: {
          status,
          updatedAt: new Date()
        }
      }
    );
    return result.modifiedCount > 0;
  }

  // Enhanced Profile Customization
  async updateProfileCustomization(
    userId: ObjectId,
    customization: Partial<UserProfileDocument['customization']>
  ): Promise<boolean> {
    const defaultCustomization: UserProfileDocument['customization'] = {
      theme: 'light',
      layout: 'grid',
      showStats: true,
      privacySettings: {
        profileVisibility: 'public',
        storyComments: 'followers',
        allowSharing: true,
        showActivity: true
      }
    };

    const profile = await this.profilesCollection.findOne({ userId });
    const currentCustomization = profile?.customization || defaultCustomization;

    const updatedCustomization = {
      ...currentCustomization,
      ...customization,
      privacySettings: {
        ...currentCustomization.privacySettings,
        ...customization.privacySettings
      }
    };

    const result = await this.profilesCollection.updateOne(
      { userId },
      {
        $set: {
          customization: updatedCustomization,
          updatedAt: new Date()
        }
      }
    );
    return result.modifiedCount > 0;
  }

  async getProfileCustomization(userId: ObjectId): Promise<UserProfileDocument['customization'] | null> {
    const profile = await this.profilesCollection.findOne(
      { userId },
      { projection: { customization: 1 } }
    );
    return profile?.customization || null;
  }

  async getContentReports(contentId: ObjectId): Promise<WithId<ContentReportDocument>[]> {
    return this.reportsCollection
      .find({ contentId })
      .sort({ createdAt: -1 })
      .toArray();
  }

  async isFollowing(followerId: ObjectId, followedId: ObjectId): Promise<boolean> {
    const follow = await this.followsCollection.findOne({
      followerId,
      followedId
    });
    return !!follow;
  }

  async searchStories(query: string, page: number = 1, limit: number = 20): Promise<WithId<StoryDocument>[]> {
    const skip = (page - 1) * limit;
    
    return this.storiesCollection
      .find({
        $text: { $search: query },
        visibility: 'public'
      })
      .sort({ score: { $meta: 'textScore' } })
      .skip(skip)
      .limit(limit)
      .toArray();
  }

  async getStoriesByDateRange(
    startDate: Date,
    endDate: Date,
    page: number = 1,
    limit: number = 20
  ): Promise<WithId<StoryDocument>[]> {
    const skip = (page - 1) * limit;
    
    return this.storiesCollection
      .find({
        createdAt: {
          $gte: startDate,
          $lte: endDate
        },
        visibility: 'public'
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();
  }

  async isUserBlocked(blockerId: ObjectId, blockedId: ObjectId): Promise<boolean> {
    const block = await this.blocksCollection.findOne({
      blockerId,
      blockedId
    });
    return !!block;
  }

  async hasUserReported(contentId: ObjectId, reporterId: ObjectId): Promise<boolean> {
    const report = await this.reportsCollection.findOne({
      contentId,
      reporterId
    });
    return !!report;
  }

  async getFollowingUsers(userId: ObjectId): Promise<UserWithoutSensitiveData[]> {
    const follows = await this.followsCollection
      .find({ followerId: userId })
      .toArray();

    const followedIds = follows.map(f => f.followedId);
    
    const users = await this.usersCollection
      .find({ _id: { $in: followedIds } })
      .project<UserWithoutSensitiveData>({
        email: 0,
        password: 0,
        role: 0
      })
      .toArray();

    return users;
  }

  async getFollowerUsers(userId: ObjectId): Promise<UserWithoutSensitiveData[]> {
    const follows = await this.followsCollection
      .find({ followedId: userId })
      .toArray();

    const followerIds = follows.map(f => f.followerId);
    
    const users = await this.usersCollection
      .find({ _id: { $in: followerIds } })
      .project<UserWithoutSensitiveData>({
        email: 0,
        password: 0,
        role: 0
      })
      .toArray();

    return users;
  }

  async getFollowingCount(userId: ObjectId): Promise<number> {
    return this.followsCollection.countDocuments({ followerId: userId });
  }

  async getFollowersCount(userId: ObjectId): Promise<number> {
    return this.followsCollection.countDocuments({ followedId: userId });
  }

  async getStoryCommentsCount(storyId: ObjectId): Promise<number> {
    return this.commentsCollection.countDocuments({ storyId });
  }

  async getStoryReactionsCount(storyId: ObjectId): Promise<number> {
    return this.reactionsCollection.countDocuments({ storyId });
  }

  async getStorySharesCount(storyId: ObjectId): Promise<number> {
    return this.sharesCollection.countDocuments({ storyId });
  }

  async getUserBlocksCount(userId: ObjectId): Promise<number> {
    return this.blocksCollection.countDocuments({ blockerId: userId });
  }

  async getContentReportsCount(contentId: ObjectId): Promise<number> {
    return this.reportsCollection.countDocuments({ contentId });
  }
} 

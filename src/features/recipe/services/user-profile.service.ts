import type { Collection, WithId, UpdateFilter, Filter, Document } from 'mongodb';
import { ObjectId } from 'mongodb';
import { DatabaseService } from '../db/database.service.js';
import { WebSocketService } from './websocket-service.js';
import type { 
  UserProfile,
  UpdateProfileDTO,
  CreateCollectionDTO,
  GDPRConsentDTO,
  DataExportRequest,
  FollowResponse
} from '../types/user.js';
import { NotFoundError } from '../utils/errors.js';
import logger from '../utils/logger.js';

type UserProfileDocument = WithId<UserProfile>;

export class UserProfileService {
  private static instance: UserProfileService | null = null;
  private readonly COLLECTION = 'users';
  private db: DatabaseService;
  private ws: WebSocketService;

  private constructor() {
    this.db = DatabaseService.getInstance();
    this.ws = WebSocketService.getInstance();
  }

  public static getInstance(): UserProfileService {
    if (!UserProfileService.instance) {
      UserProfileService.instance = new UserProfileService();
    }
    return UserProfileService.instance;
  }

  private getCollection(): Collection<UserProfileDocument> {
    return this.db.getCollection<UserProfileDocument>(this.COLLECTION);
  }

  public async getProfile(userId: ObjectId, viewerId?: ObjectId): Promise<Partial<UserProfileDocument>> {
    const profile = await this.getCollection().findOne({ _id: userId });
    if (!profile) {
      throw new NotFoundError('Profile not found');
    }

    if (viewerId?.equals(userId)) {
      return profile;
    }

    const isFollower = viewerId ? profile.followers.some(id => id.equals(viewerId)) : false;
    const canViewProfile = this.canViewContent(profile.preferences.privacy.profileVisibility, isFollower);

    if (!canViewProfile) {
      return {
        _id: profile._id,
        name: profile.name,
        avatar: profile.avatar,
        stats: profile.stats,
      };
    }

    const { email, ...publicProfile } = profile;
    return publicProfile;
  }

  public async updateProfile(userId: ObjectId, updates: UpdateProfileDTO): Promise<UserProfileDocument> {
    const baseUpdate: UpdateFilter<UserProfileDocument> = {
      $set: {
        updatedAt: new Date(),
        ...(updates.name && { name: updates.name }),
        ...(updates.bio && { bio: updates.bio }),
        ...(updates.location && { location: updates.location }),
        ...(updates.website && { website: updates.website }),
        ...(updates.avatar && { avatar: updates.avatar }),
        ...(updates.socialLinks && { socialLinks: updates.socialLinks }),
      }
    };

    if (updates.preferences) {
      const preferences = {
        dietary: updates.preferences.dietary ?? [],
        cuisine: updates.preferences.cuisine ?? [],
        notifications: {
          email: updates.preferences.notifications?.email ?? true,
          push: updates.preferences.notifications?.push ?? true,
          inApp: updates.preferences.notifications?.inApp ?? true,
        },
        privacy: {
          profileVisibility: updates.preferences.privacy?.profileVisibility || 'public',
          recipeVisibility: updates.preferences.privacy?.recipeVisibility || 'public',
          activityVisibility: updates.preferences.privacy?.activityVisibility || 'public',
        },
      };
      (baseUpdate.$set as any).preferences = preferences;
    }

    const result = await this.getCollection().findOneAndUpdate(
      { _id: userId },
      baseUpdate,
      { returnDocument: 'after' }
    );

    if (!result) {
      throw new NotFoundError('Profile not found');
    }

    // We know the document is complete after update
    return (result as unknown) as UserProfileDocument;
  }

  public async followUser(followerId: ObjectId, targetId: ObjectId): Promise<FollowResponse> {
    if (followerId.equals(targetId)) {
      throw new Error('Cannot follow yourself');
    }

    const update: UpdateFilter<UserProfileDocument> = {
      $addToSet: { 'followers': followerId } as any,
      $inc: { 'stats.followers': 1 }
    };

    const result = await this.getCollection().updateOne(
      { _id: targetId },
      update
    );

    if (result.matchedCount === 0) {
      throw new NotFoundError('Target user not found');
    }

    const followingUpdate: UpdateFilter<UserProfileDocument> = {
      $addToSet: { 'following': targetId } as any,
      $inc: { 'stats.following': 1 }
    };

    await this.getCollection().updateOne(
      { _id: followerId },
      followingUpdate
    );

    const targetProfile = await this.getCollection().findOne({ _id: targetId });
    if (!targetProfile) {
      throw new NotFoundError('Target user not found');
    }

    this.ws.broadcast('new_follower', {
      userId: targetId.toString(),
      followerId: followerId.toString(),
    });

    return {
      success: true,
      isFollowing: true,
      followerCount: targetProfile.stats.followers,
    };
  }

  public async unfollowUser(followerId: ObjectId, targetId: ObjectId): Promise<FollowResponse> {
    const update: UpdateFilter<UserProfileDocument> = {
      $pull: { 'followers': followerId } as any,
      $inc: { 'stats.followers': -1 }
    };

    const result = await this.getCollection().updateOne(
      { _id: targetId },
      update
    );

    if (result.matchedCount === 0) {
      throw new NotFoundError('Target user not found');
    }

    const unfollowUpdate: UpdateFilter<UserProfileDocument> = {
      $pull: { 'following': targetId } as any,
      $inc: { 'stats.following': -1 }
    };

    await this.getCollection().updateOne(
      { _id: followerId },
      unfollowUpdate
    );

    const targetProfile = await this.getCollection().findOne({ _id: targetId });
    if (!targetProfile) {
      throw new NotFoundError('Target user not found');
    }

    return {
      success: true,
      isFollowing: false,
      followerCount: targetProfile.stats.followers,
    };
  }

  public async createCollection(userId: ObjectId, collection: CreateCollectionDTO): Promise<UserProfileDocument> {
    const update: UpdateFilter<UserProfileDocument> = {
      $push: {
        'collections': {
          _id: new ObjectId(),
          ...collection,
          recipeCount: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        }
      } as any
    };

    const result = await this.getCollection().findOneAndUpdate(
      { _id: userId },
      update,
      { returnDocument: 'after' }
    );

    if (!result) {
      throw new NotFoundError('Profile not found');
    }

    return (result as unknown) as UserProfileDocument;
  }

  public async updateGDPRConsent(userId: ObjectId, consent: GDPRConsentDTO): Promise<void> {
    const update: UpdateFilter<UserProfileDocument> = {
      $set: {
        'gdprConsent': {
          ...consent,
          consentDate: new Date(),
        }
      } as any
    };

    const result = await this.getCollection().updateOne(
      { _id: userId },
      update
    );

    if (result.matchedCount === 0) {
      throw new NotFoundError('Profile not found');
    }
  }

  public async requestDataExport(userId: ObjectId, request: DataExportRequest): Promise<void> {
    const update: UpdateFilter<UserProfileDocument> = {
      $push: {
        'dataExports': {
          requestDate: new Date(),
          status: 'pending',
          type: request.type,
          format: request.format,
        }
      } as any
    };

    const result = await this.getCollection().updateOne(
      { _id: userId },
      update
    );

    if (result.matchedCount === 0) {
      throw new NotFoundError('Profile not found');
    }
  }

  public async deleteAccount(userId: ObjectId): Promise<void> {
    const update: UpdateFilter<UserProfileDocument> = {
      $set: {
        accountStatus: 'deleted',
        email: `deleted_${userId}_${Date.now()}@deleted.com`,
        name: 'Deleted User',
        avatar: undefined,
        bio: undefined,
        location: undefined,
        website: undefined,
        socialLinks: undefined,
        updatedAt: new Date(),
      }
    };

    const result = await this.getCollection().updateOne(
      { _id: userId },
      update
    );

    if (result.matchedCount === 0) {
      throw new NotFoundError('Profile not found');
    }

    const filter: Filter<UserProfileDocument> = {
      $or: [{ followers: userId }, { following: userId }]
    };

    const pullUpdate: UpdateFilter<UserProfileDocument> = {
      $pull: {
        followers: userId,
        following: userId
      } as any
    };

    await this.getCollection().updateMany(filter, pullUpdate);
  }

  private canViewContent(visibility: 'public' | 'private' | 'followers', isFollower: boolean): boolean {
    switch (visibility) {
      case 'public':
        return true;
      case 'followers':
        return isFollower;
      case 'private':
        return false;
      default:
        return false;
    }
  }
}
import { Collection, ObjectId } from 'mongodb';
import { DatabaseService } from '../../../core/database/database.service';
import { UserRole, DietaryRestriction, CuisineType } from '../../../constants';

export interface UserPreferences {
  cuisine?: CuisineType[];
  dietaryRestrictions?: DietaryRestriction[];
  cookingLevel?: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
  servingSize?: number;
  measurementSystem?: 'METRIC' | 'IMPERIAL';
  emailNotifications?: boolean;
  pushNotifications?: boolean;
  privateProfile?: boolean;
}

export interface UserProfile {
  _id: ObjectId;
  email: string;
  displayName?: string;
  bio?: string;
  website?: string | null;
  location?: string;
  avatar?: string;
  preferences: UserPreferences;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
  stats?: {
    recipeCount: number;
    followerCount: number;
    followingCount: number;
    totalLikes: number;
  };
  isFollowing?: boolean;
}

export class UserService {
  private collection: Collection<UserProfile>;

  constructor(private databaseService: DatabaseService) {
    this.collection = this.databaseService.getCollection<UserProfile>('users');
  }

  async getUserProfile(userId: ObjectId, requestingUserId?: ObjectId): Promise<UserProfile | null> {
    const pipeline = [
      { $match: { _id: userId } },
      {
        $lookup: {
          from: 'recipes',
          localField: '_id',
          foreignField: 'userId',
          as: 'recipes'
        }
      },
      {
        $lookup: {
          from: 'followers',
          localField: '_id',
          foreignField: 'followedId',
          as: 'followers'
        }
      },
      {
        $lookup: {
          from: 'followers',
          localField: '_id',
          foreignField: 'followerId',
          as: 'following'
        }
      },
      {
        $project: {
          _id: 1,
          email: 1,
          displayName: 1,
          bio: 1,
          website: 1,
          location: 1,
          avatar: 1,
          preferences: 1,
          role: 1,
          createdAt: 1,
          updatedAt: 1,
          stats: {
            recipeCount: { $size: '$recipes' },
            followerCount: { $size: '$followers' },
            followingCount: { $size: '$following' },
            totalLikes: {
              $reduce: {
                input: '$recipes',
                initialValue: 0,
                in: { $add: ['$$value', { $ifNull: ['$$this.likeCount', 0] }] }
              }
            }
          }
        }
      }
    ];

    const user = await this.collection.aggregate<UserProfile>(pipeline).next();

    if (!user) {
      return null;
    }

    // Check if requesting user follows this user
    if (requestingUserId) {
      const isFollowing = await this.collection.findOne({
        _id: requestingUserId,
        'following': userId
      });
      user.isFollowing = !!isFollowing;
    }

    return user;
  }

  async updateProfile(userId: ObjectId, profile: Partial<UserProfile>): Promise<UserProfile | null> {
    const result = await this.collection.findOneAndUpdate(
      { _id: userId },
      {
        $set: {
          ...profile,
          updatedAt: new Date()
        }
      },
      { returnDocument: 'after' }
    );

    return result;
  }

  async updatePreferences(userId: ObjectId, preferences: UserPreferences): Promise<boolean> {
    const result = await this.collection.updateOne(
      { _id: userId },
      {
        $set: {
          'preferences': preferences,
          updatedAt: new Date()
        }
      }
    );

    return result.modifiedCount > 0;
  }

  async toggleFollow(followerId: ObjectId, followedId: ObjectId): Promise<boolean> {
    const existingFollow = await this.collection.findOne({
      _id: followerId,
      following: followedId
    });

    if (existingFollow) {
      // Unfollow
      const result = await this.collection.updateOne(
        { _id: followerId },
        {
          $pull: { following: followedId },
          $set: { updatedAt: new Date() }
        }
      );
      return false;
    } else {
      // Follow
      const result = await this.collection.updateOne(
        { _id: followerId },
        {
          $addToSet: { following: followedId },
          $set: { updatedAt: new Date() }
        }
      );
      return true;
    }
  }
} 
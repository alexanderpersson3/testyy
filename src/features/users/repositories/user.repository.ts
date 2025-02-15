import { Collection, Document, ObjectId, UpdateFilter } from 'mongodb';
import { databaseService } from '../../../core/database/database.service';
import { UserProfile, UserPreferences } from '../dto/user.dto';

interface User extends Document {
  _id: ObjectId;
  email: string;
  password: string;
  name: string;
  preferences: {
    dietaryRestrictions: string[];
    allergies: string[];
    cuisinePreferences: string[];
  };
  following: ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

export class UserRepository {
  private static instance: UserRepository;
  private collection: Collection<User>;

  private constructor() {
    this.collection = databaseService.getCollection<User>('users');
  }

  public static getInstance(): UserRepository {
    if (!UserRepository.instance) {
      UserRepository.instance = new UserRepository();
    }
    return UserRepository.instance;
  }

  async getUserProfile(userId: string) {
    const userObjectId = new ObjectId(userId);
    
    return this.collection
      .aggregate([
        { $match: { _id: userObjectId } },
        {
          $lookup: {
            from: 'recipes',
            localField: '_id',
            foreignField: 'userId',
            as: 'recipes',
          },
        },
        {
          $lookup: {
            from: 'followers',
            localField: '_id',
            foreignField: 'followedId',
            as: 'followers',
          },
        },
        {
          $lookup: {
            from: 'followers',
            localField: '_id',
            foreignField: 'followerId',
            as: 'following',
          },
        },
        {
          $project: {
            username: 1,
            displayName: 1,
            bio: 1,
            website: 1,
            location: 1,
            avatar: 1,
            createdAt: 1,
            preferences: 1,
            stats: {
              recipeCount: { $size: '$recipes' },
              followerCount: { $size: '$followers' },
              followingCount: { $size: '$following' },
              totalLikes: {
                $reduce: {
                  input: '$recipes',
                  initialValue: 0,
                  in: { $add: ['$$value', { $ifNull: ['$$this.likeCount', 0] }] },
                },
              },
            },
          },
        },
      ])
      .next();
  }

  async findById(id: ObjectId): Promise<User | null> {
    return this.collection.findOne({ _id: id });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.collection.findOne({ email });
  }

  async create(userData: Pick<User, 'email' | 'password' | 'name'>): Promise<User> {
    const now = new Date();
    const newUser: User = {
      _id: new ObjectId(),
      ...userData,
      preferences: {
        dietaryRestrictions: [],
        allergies: [],
        cuisinePreferences: []
      },
      following: [],
      createdAt: now,
      updatedAt: now
    };
    await this.collection.insertOne(newUser);
    return newUser;
  }

  async updateProfile(
    id: ObjectId, 
    update: Partial<Pick<User, 'name' | 'email' | 'password'>>
  ): Promise<boolean> {
    const result = await this.collection.updateOne(
      { _id: id },
      { 
        $set: { 
          ...update,
          updatedAt: new Date()
        }
      }
    );
    return result.modifiedCount > 0;
  }

  async updatePreferences(
    id: ObjectId, 
    preferences: User['preferences']
  ): Promise<boolean> {
    const result = await this.collection.updateOne(
      { _id: id },
      { 
        $set: { 
          preferences,
          updatedAt: new Date()
        }
      }
    );
    return result.modifiedCount > 0;
  }

  async checkFollowStatus(followerId: string, followedId: string) {
    const followerObjectId = new ObjectId(followerId);
    const followedObjectId = new ObjectId(followedId);
    
    return this.collection.findOne({
      _id: followerObjectId,
      following: followedObjectId,
    });
  }

  async follow(followerId: string, followedId: string) {
    const followerObjectId = new ObjectId(followerId);
    const followedObjectId = new ObjectId(followedId);
    
    return this.collection.updateOne(
      { _id: followerObjectId },
      {
        $addToSet: { following: followedObjectId },
        $set: { updatedAt: new Date() }
      }
    );
  }

  async unfollow(followerId: string, followedId: string) {
    const followerObjectId = new ObjectId(followerId);
    const followedObjectId = new ObjectId(followedId);
    
    return this.collection.updateOne(
      { _id: followerObjectId },
      {
        $pull: { following: followedObjectId },
        $set: { updatedAt: new Date() }
      }
    );
  }

  async followUser(userId: ObjectId, targetUserId: ObjectId): Promise<boolean> {
    const result = await this.collection.updateOne(
      { _id: userId },
      {
        $addToSet: { following: targetUserId },
        $set: { updatedAt: new Date() }
      } as any // Type assertion needed due to MongoDB types limitation
    );
    return result.modifiedCount > 0;
  }

  async unfollowUser(userId: ObjectId, targetUserId: ObjectId): Promise<boolean> {
    const result = await this.collection.updateOne(
      { _id: userId },
      {
        $pull: { following: targetUserId },
        $set: { updatedAt: new Date() }
      } as any // Type assertion needed due to MongoDB types limitation
    );
    return result.modifiedCount > 0;
  }

  async isFollowing(followerId: string, followedId: string): Promise<boolean> {
    const followerObjectId = new ObjectId(followerId);
    const followedObjectId = new ObjectId(followedId);
    
    const user = await this.collection.findOne({
      _id: followerObjectId,
      following: followedObjectId
    });
    return !!user;
  }
} 
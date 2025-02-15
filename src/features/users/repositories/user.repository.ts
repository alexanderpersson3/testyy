import { ObjectId } from 'mongodb';
import { getDb } from '../../../db';
import { UserProfile, UserPreferences } from '../dto/user.dto';

export class UserRepository {
  private static instance: UserRepository;
  private db = getDb();

  public static getInstance(): UserRepository {
    if (!UserRepository.instance) {
      UserRepository.instance = new UserRepository();
    }
    return UserRepository.instance;
  }

  async getUserProfile(userId: string) {
    const userObjectId = new ObjectId(userId);
    
    return this.db
      .collection('users')
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

  async updateProfile(userId: string, profile: Partial<UserProfile>) {
    const userObjectId = new ObjectId(userId);
    
    return this.db.collection('users').findOneAndUpdate(
      { _id: userObjectId },
      {
        $set: {
          ...profile,
          updatedAt: new Date(),
        },
      },
      { returnDocument: 'after' }
    );
  }

  async updatePreferences(userId: string, preferences: Partial<UserPreferences>) {
    const userObjectId = new ObjectId(userId);
    
    return this.db.collection('users').findOneAndUpdate(
      { _id: userObjectId },
      {
        $set: {
          'preferences': preferences,
          updatedAt: new Date(),
        },
      },
      { returnDocument: 'after' }
    );
  }

  async checkFollowStatus(followerId: string, followedId: string) {
    const followerObjectId = new ObjectId(followerId);
    const followedObjectId = new ObjectId(followedId);
    
    return this.db.collection('followers').findOne({
      followerId: followerObjectId,
      followedId: followedObjectId,
    });
  }

  async follow(followerId: string, followedId: string) {
    const followerObjectId = new ObjectId(followerId);
    const followedObjectId = new ObjectId(followedId);
    
    return this.db.collection('followers').insertOne({
      followerId: followerObjectId,
      followedId: followedObjectId,
      createdAt: new Date(),
    });
  }

  async unfollow(followerId: string, followedId: string) {
    const followerObjectId = new ObjectId(followerId);
    const followedObjectId = new ObjectId(followedId);
    
    return this.db.collection('followers').deleteOne({
      followerId: followerObjectId,
      followedId: followedObjectId,
    });
  }
} 
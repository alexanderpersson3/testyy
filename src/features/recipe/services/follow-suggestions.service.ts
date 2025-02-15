;
;
import type { Collection } from 'mongodb';
import { DatabaseService } from '../db/database.service.js';;
import { Follow, UserProfile } from '../types/social.js';;

export class FollowSuggestionsService {
  private db: DatabaseService;

  constructor(db: DatabaseService) {
    this.db = db;
  }

  async getFollowSuggestions(
    userId: ObjectId
  ): Promise<Array<{ userId: ObjectId; score: number }>> {
    // Get user's current follows
    const userFollowing = await this.db
      .getCollection<Follow>('follows')
      .find({ followerId: userId })
      .toArray();

    const followingIds = userFollowing.map((follow: Follow) => follow.followedId);

    // Get mutual follows
    const mutualFollows = await this.db
      .getCollection<Follow>('follows')
      .find({
        followerId: { $in: followingIds },
        followedId: { $nin: [...followingIds, userId] },
      })
      .toArray();

    // Count mutual follows
    const mutualCounts = new Map<string, number>();
    mutualFollows.forEach((follow: Follow) => {
      const key = follow.followedId.toString();
      mutualCounts.set(key, (mutualCounts.get(key) || 0) + 1);
    });

    // Get profiles for suggested users
    const profiles = await this.db
      .getCollection<UserProfile>('user_profiles')
      .find({
        _id: { $in: Array.from(mutualCounts.keys()).map(id => new ObjectId(id)) },
      })
      .toArray();

    return profiles.map((profile: UserProfile) => ({
      userId: profile._id,
      score: mutualCounts.get(profile._id.toString()) || 0,
    }));
  }
}

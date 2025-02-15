import { DatabaseService } from '../db/database.service.js';
import { Follow, UserProfile } from '../types/social.js';
export class FollowSuggestionsService {
    constructor(db) {
        this.db = db;
    }
    async getFollowSuggestions(userId) {
        // Get user's current follows
        const userFollowing = await this.db
            .getCollection('follows')
            .find({ followerId: userId })
            .toArray();
        const followingIds = userFollowing.map((follow) => follow.followedId);
        // Get mutual follows
        const mutualFollows = await this.db
            .getCollection('follows')
            .find({
            followerId: { $in: followingIds },
            followedId: { $nin: [...followingIds, userId] },
        })
            .toArray();
        // Count mutual follows
        const mutualCounts = new Map();
        mutualFollows.forEach((follow) => {
            const key = follow.followedId.toString();
            mutualCounts.set(key, (mutualCounts.get(key) || 0) + 1);
        });
        // Get profiles for suggested users
        const profiles = await this.db
            .getCollection('user_profiles')
            .find({
            _id: { $in: Array.from(mutualCounts.keys()).map(id => new ObjectId(id)) },
        })
            .toArray();
        return profiles.map((profile) => ({
            userId: profile._id,
            score: mutualCounts.get(profile._id.toString()) || 0,
        }));
    }
}
//# sourceMappingURL=follow-suggestions.service.js.map
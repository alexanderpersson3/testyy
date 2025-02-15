import { Db } from 'mongodb';
import { CreateStoryInput, CreateStoryCommentInput, CreateStoryReactionInput, CreateStoryShareInput, CreateUserBlockInput, CreateContentReportInput, CreateUserFollowInput, UserWithoutSensitiveData, ExploreContent, } from '../types/social.js';
import { User } from '../types/user.js';
export class SocialService {
    constructor(db) {
        this.db = db;
        this.initializeCollections();
    }
    async initializeCollections() {
        this.storiesCollection = this.db.collection('stories');
        this.followsCollection = this.db.collection('follows');
        this.profilesCollection = this.db.collection('profiles');
        this.usersCollection = this.db.collection('users');
        this.commentsCollection = this.db.collection('comments');
        this.reactionsCollection = this.db.collection('reactions');
        this.blocksCollection = this.db.collection('blocks');
        this.reportsCollection = this.db.collection('reports');
        this.sharesCollection = this.db.collection('shares');
    }
    // Profile Management
    async getProfile(userId) {
        return this.profilesCollection.findOne({ userId });
    }
    async updateProfile(userId, updates) {
        const result = await this.profilesCollection.updateOne({ userId }, {
            $set: {
                ...updates,
                updatedAt: new Date(),
            },
        }, { upsert: true });
        return result.acknowledged;
    }
    async addHighlight(userId, highlight) {
        const highlightWithMeta = {
            _id: new ObjectId(),
            ...highlight,
            createdAt: new Date(),
        };
        const update = {
            $push: { highlights: highlightWithMeta },
            $set: { updatedAt: new Date() },
        };
        const result = await this.profilesCollection.updateOne({ userId }, update);
        return result.modifiedCount > 0 ? highlightWithMeta._id : null;
    }
    async removeHighlight(userId, highlightId) {
        const update = {
            $pull: { highlights: { _id: highlightId } },
            $set: { updatedAt: new Date() },
        };
        const result = await this.profilesCollection.updateOne({ userId }, update);
        return result.modifiedCount > 0;
    }
    // Follow System
    async followUser(followerId, followedId) {
        // Check if already following
        const existing = await this.followsCollection.findOne({
            followerId,
            followedId,
        });
        if (existing) {
            return false;
        }
        const now = new Date();
        const follow = {
            _id: new ObjectId(),
            followerId,
            followedId,
            createdAt: now,
            updatedAt: now,
        };
        const [followResult] = await Promise.all([
            this.followsCollection.insertOne(follow),
            this.profilesCollection.updateOne({ userId: followerId }, { $inc: { 'stats.following': 1 } }),
            this.profilesCollection.updateOne({ userId: followedId }, { $inc: { 'stats.followers': 1 } }),
        ]);
        return followResult.acknowledged;
    }
    async unfollowUser(followerId, followedId) {
        const result = await this.followsCollection.deleteOne({
            followerId,
            followedId,
        });
        if (result.deletedCount > 0) {
            await Promise.all([
                this.profilesCollection.updateOne({ userId: followerId }, { $inc: { 'stats.following': -1 } }),
                this.profilesCollection.updateOne({ userId: followedId }, { $inc: { 'stats.followers': -1 } }),
            ]);
            return true;
        }
        return false;
    }
    async getFollowers(userId) {
        return this.followsCollection.find({ followedId: userId }).toArray();
    }
    async getFollowing(userId) {
        return this.followsCollection.find({ followerId: userId }).toArray();
    }
    // Stories
    async createStory(input) {
        const story = {
            _id: new ObjectId(),
            ...input,
            likes: 0,
            views: 0,
            shares: 0,
            comments: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        const result = await this.storiesCollection.insertOne(story);
        return result.insertedId;
    }
    async createStoryComment(input) {
        const comment = {
            _id: new ObjectId(),
            ...input,
            likes: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        const result = await this.commentsCollection.insertOne(comment);
        return result.insertedId;
    }
    async createStoryReaction(input) {
        const reaction = {
            _id: new ObjectId(),
            ...input,
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        const result = await this.reactionsCollection.insertOne(reaction);
        return result.insertedId;
    }
    async createStoryShare(input) {
        const share = {
            _id: new ObjectId(),
            ...input,
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        const result = await this.sharesCollection.insertOne(share);
        return result.insertedId;
    }
    async createUserBlock(input) {
        const block = {
            _id: new ObjectId(),
            ...input,
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        const result = await this.blocksCollection.insertOne(block);
        return result.insertedId;
    }
    async createContentReport(input) {
        const report = {
            _id: new ObjectId(),
            ...input,
            status: 'pending',
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        const result = await this.reportsCollection.insertOne(report);
        return result.insertedId;
    }
    async createUserFollow(input) {
        const now = new Date();
        const follow = {
            _id: new ObjectId(),
            ...input,
            createdAt: now,
            updatedAt: now
        };
        const result = await this.followsCollection.insertOne(follow);
        return result.insertedId;
    }
    async getStories(userId) {
        return this.storiesCollection.find({ userId }).sort({ createdAt: -1 }).toArray();
    }
    async viewStory(storyId) {
        const result = await this.storiesCollection.updateOne({ _id: storyId }, {
            $inc: { views: 1 },
            $set: { updatedAt: new Date() },
        });
        return result.modifiedCount > 0;
    }
    // Explore Feed
    async getExploreFeed(userId, page = 1, limit = 20) {
        const skip = (page - 1) * limit;
        return this.storiesCollection
            .find({
            userId: { $ne: userId },
            visibility: 'public',
        })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .toArray();
    }
    // Popular Users
    async getPopularUsers(limit = 10) {
        return this.profilesCollection.find().sort({ 'stats.followers': -1 }).limit(limit).toArray();
    }
    // User Stats
    async updateUserStats(userId, updates) {
        const result = await this.profilesCollection.updateOne({ userId }, {
            $inc: updates,
            $set: { updatedAt: new Date() },
        });
        return result.modifiedCount > 0;
    }
    // Comments
    async addComment(storyId, userId, content) {
        const now = new Date();
        const comment = {
            _id: new ObjectId(),
            storyId,
            userId,
            content,
            likes: 0,
            createdAt: now,
            updatedAt: now,
        };
        const result = await this.commentsCollection.insertOne(comment);
        return result.acknowledged ? result.insertedId : null;
    }
    async getStoryComments(storyId) {
        return this.commentsCollection
            .find({ storyId })
            .sort({ createdAt: -1 })
            .toArray();
    }
    // Reactions
    async addReaction(storyId, userId, type) {
        // Remove any existing reaction from this user
        await this.reactionsCollection.deleteOne({ storyId, userId });
        const now = new Date();
        const reaction = {
            _id: new ObjectId(),
            storyId,
            userId,
            type,
            createdAt: now,
            updatedAt: now,
        };
        const result = await this.reactionsCollection.insertOne(reaction);
        return result.acknowledged;
    }
    async removeReaction(storyId, userId) {
        const result = await this.reactionsCollection.deleteOne({ storyId, userId });
        return result.deletedCount > 0;
    }
    async getStoryReactions(storyId) {
        return this.reactionsCollection
            .find({ storyId })
            .sort({ createdAt: -1 })
            .toArray();
    }
    // Story Sharing
    async shareStory(storyId, userId, sharedToId, message) {
        const now = new Date();
        const share = {
            _id: new ObjectId(),
            storyId,
            userId,
            sharedToId,
            message,
            createdAt: now,
            updatedAt: now,
        };
        const result = await this.sharesCollection.insertOne(share);
        return result.acknowledged ? result.insertedId : null;
    }
    async getStoryShares(storyId) {
        return this.sharesCollection
            .find({ storyId })
            .sort({ createdAt: -1 })
            .toArray();
    }
    // User Blocking
    async blockUser(blockerId, blockedId, reason) {
        // Check if already blocked
        const existing = await this.blocksCollection.findOne({
            blockerId,
            blockedId,
        });
        if (existing) {
            return false;
        }
        const now = new Date();
        const block = {
            _id: new ObjectId(),
            blockerId,
            blockedId,
            reason,
            createdAt: now,
            updatedAt: now,
        };
        // Remove any existing follows
        await Promise.all([
            this.followsCollection.deleteOne({
                followerId: blockerId,
                followedId: blockedId,
            }),
            this.followsCollection.deleteOne({
                followerId: blockedId,
                followedId: blockerId,
            }),
        ]);
        const result = await this.blocksCollection.insertOne(block);
        return result.acknowledged;
    }
    async unblockUser(blockerId, blockedId) {
        const result = await this.blocksCollection.deleteOne({
            blockerId,
            blockedId,
        });
        return result.deletedCount > 0;
    }
    async getUserBlocks(userId) {
        return this.blocksCollection
            .find({ blockerId: userId })
            .sort({ createdAt: -1 })
            .toArray();
    }
    // Content Reporting
    async reportContent(reporterId, contentType, contentId, reason, description) {
        const now = new Date();
        const report = {
            _id: new ObjectId(),
            reporterId,
            contentType,
            contentId,
            reason,
            description,
            status: 'pending',
            createdAt: now,
            updatedAt: now,
        };
        const result = await this.reportsCollection.insertOne(report);
        return result.acknowledged ? result.insertedId : null;
    }
    async updateReportStatus(reportId, status) {
        const result = await this.reportsCollection.updateOne({ _id: reportId }, {
            $set: {
                status,
                updatedAt: new Date(),
            },
        });
        return result.modifiedCount > 0;
    }
    // Enhanced Profile Customization
    async updateProfileCustomization(userId, customization) {
        const defaultCustomization = {
            theme: 'light',
            layout: 'grid',
            showStats: true,
            privacySettings: {
                profileVisibility: 'public',
                storyComments: 'followers',
                allowSharing: true,
                showActivity: true,
            },
        };
        const profile = await this.profilesCollection.findOne({ userId });
        const currentCustomization = profile?.customization || defaultCustomization;
        const updatedCustomization = {
            ...currentCustomization,
            ...customization,
            privacySettings: {
                ...currentCustomization.privacySettings,
                ...customization.privacySettings,
            },
        };
        const result = await this.profilesCollection.updateOne({ userId }, {
            $set: {
                customization: updatedCustomization,
                updatedAt: new Date(),
            },
        });
        return result.modifiedCount > 0;
    }
    async getProfileCustomization(userId) {
        const profile = await this.profilesCollection.findOne({ userId }, { projection: { customization: 1 } });
        return profile?.customization || null;
    }
    async getContentReports(contentId) {
        return this.reportsCollection.find({ contentId }).sort({ createdAt: -1 }).toArray();
    }
    async isFollowing(followerId, followedId) {
        const follow = await this.followsCollection.findOne({
            followerId,
            followedId,
        });
        return !!follow;
    }
    async searchStories(query, page = 1, limit = 20) {
        const skip = (page - 1) * limit;
        return this.storiesCollection
            .find({
            $text: { $search: query },
            visibility: 'public',
        })
            .sort({ score: { $meta: 'textScore' } })
            .skip(skip)
            .limit(limit)
            .toArray();
    }
    async getStoriesByDateRange(startDate, endDate, page = 1, limit = 20) {
        const skip = (page - 1) * limit;
        return this.storiesCollection
            .find({
            createdAt: {
                $gte: startDate,
                $lte: endDate,
            },
            visibility: 'public',
        })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .toArray();
    }
    async isUserBlocked(blockerId, blockedId) {
        const block = await this.blocksCollection.findOne({
            blockerId,
            blockedId,
        });
        return !!block;
    }
    async hasUserReported(contentId, reporterId) {
        const report = await this.reportsCollection.findOne({
            contentId,
            reporterId,
        });
        return !!report;
    }
    async getFollowingUsers(userId) {
        const follows = await this.followsCollection.find({ followerId: userId }).toArray();
        const followedIds = follows.map(f => f.followedId);
        const users = await this.usersCollection
            .find({ _id: { $in: followedIds } })
            .project({
            email: 0,
            password: 0,
            role: 0,
        })
            .toArray();
        return users;
    }
    async getFollowerUsers(userId) {
        const follows = await this.followsCollection.find({ followedId: userId }).toArray();
        const followerIds = follows.map(f => f.followerId);
        const users = await this.usersCollection
            .find({ _id: { $in: followerIds } })
            .project({
            email: 0,
            password: 0,
            role: 0,
        })
            .toArray();
        return users;
    }
    async getFollowingCount(userId) {
        return this.followsCollection.countDocuments({ followerId: userId });
    }
    async getFollowersCount(userId) {
        return this.followsCollection.countDocuments({ followedId: userId });
    }
    async getStoryCommentsCount(storyId) {
        return this.commentsCollection.countDocuments({ storyId });
    }
    async getStoryReactionsCount(storyId) {
        return this.reactionsCollection.countDocuments({ storyId });
    }
    async getStorySharesCount(storyId) {
        return this.sharesCollection.countDocuments({ storyId });
    }
    async getUserBlocksCount(userId) {
        return this.blocksCollection.countDocuments({ blockerId: userId });
    }
    async getContentReportsCount(contentId) {
        return this.reportsCollection.countDocuments({ contentId });
    }
}
//# sourceMappingURL=social.js.map
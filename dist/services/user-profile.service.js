import { ObjectId } from 'mongodb';
;
import { DatabaseService } from '../db/database.service.js';
import { WebSocketService } from '../websocket-service.js';
import { UserProfile, UpdateProfileDTO, GDPRConsentDTO } from '../types/user.js';
import { NotFoundError, ForbiddenError } from '../utils/errors.js';
import logger from '../utils/logger.js';
export class UserProfileService {
    constructor() {
        this.COLLECTION = 'users';
        this.db = DatabaseService.getInstance();
        this.ws = WebSocketService.getInstance();
    }
    static getInstance() {
        if (!UserProfileService.instance) {
            UserProfileService.instance = new UserProfileService();
        }
        return UserProfileService.instance;
    }
    getCollection() {
        return this.db.getCollection(this.COLLECTION);
    }
    async getProfile(userId, viewerId) {
        const profile = await this.getCollection().findOne({ _id: userId });
        if (!profile) {
            throw new NotFoundError('Profile not found');
        }
        // Check privacy settings
        if (viewerId?.equals(userId)) {
            // User viewing their own profile
            return profile;
        }
        const isFollower = viewerId ? profile.followers.some(id => id.equals(viewerId)) : false;
        const canViewProfile = this.canViewContent(profile.preferences.privacy.profileVisibility, isFollower);
        if (!canViewProfile) {
            return {
                _id: profile._id,
                name: profile.name,
                avatar: profile.avatar,
                stats: {
                    recipesCreated: profile.stats.recipesCreated,
                    recipesLiked: profile.stats.recipesLiked,
                    followers: profile.stats.followers,
                    following: profile.stats.following,
                    totalViews: profile.stats.totalViews,
                },
            };
        }
        // Remove sensitive information
        const { email, gdprConsent, dataExports, ...publicProfile } = profile;
        return publicProfile;
    }
    async updateProfile(userId, updates) {
        const updateData = {
            ...updates,
            updatedAt: new Date(),
        };
        if (updates.preferences) {
            updateData.preferences = {
                dietary: updates.preferences.dietary || [],
                cuisine: updates.preferences.cuisine || [],
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
        }
        const result = await this.getCollection().findOneAndUpdate({ _id: userId }, { $set: updateData }, { returnDocument: 'after' });
        if (!result) {
            throw new NotFoundError('Profile not found');
        }
        return result;
    }
    async followUser(followerId, targetId) {
        if (followerId.equals(targetId)) {
            throw new Error('Cannot follow yourself');
        }
        const result = await this.getCollection().updateOne({ _id: targetId }, {
            $addToSet: { followers: followerId },
            $inc: { 'stats.followers': 1 },
        });
        if (result.matchedCount === 0) {
            throw new NotFoundError('Target user not found');
        }
        await this.getCollection().updateOne({ _id: followerId }, {
            $addToSet: { following: targetId },
            $inc: { 'stats.following': 1 },
        });
        const targetProfile = await this.getCollection().findOne({ _id: targetId });
        if (!targetProfile) {
            throw new NotFoundError('Target user not found');
        }
        // Notify the target user through WebSocket
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
    async unfollowUser(followerId, targetId) {
        const result = await this.getCollection().updateOne({ _id: targetId }, {
            $pull: { followers: followerId },
            $inc: { 'stats.followers': -1 },
        });
        if (result.matchedCount === 0) {
            throw new NotFoundError('Target user not found');
        }
        await this.getCollection().updateOne({ _id: followerId }, {
            $pull: { following: targetId },
            $inc: { 'stats.following': -1 },
        });
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
    async createCollection(userId, collection) {
        const result = await this.getCollection().findOneAndUpdate({ _id: userId }, {
            $push: {
                'cookbook.collections': {
                    id: new ObjectId(),
                    ...collection,
                    recipeCount: 0,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                },
            },
        }, { returnDocument: 'after' });
        if (!result) {
            throw new NotFoundError('Profile not found');
        }
        return result;
    }
    async updateGDPRConsent(userId, consent) {
        const result = await this.getCollection().updateOne({ _id: userId }, {
            $set: {
                gdprConsent: {
                    ...consent,
                    consentDate: new Date(),
                },
            },
        });
        if (result.matchedCount === 0) {
            throw new NotFoundError('Profile not found');
        }
    }
    async requestDataExport(userId, request) {
        const result = await this.getCollection().updateOne({ _id: userId }, {
            $push: {
                dataExports: {
                    requestDate: new Date(),
                    status: 'pending',
                    type: request.type,
                    format: request.format,
                },
            },
        });
        if (result.matchedCount === 0) {
            throw new NotFoundError('Profile not found');
        }
        // TODO: Trigger background job to generate export
    }
    async deleteAccount(userId) {
        const result = await this.getCollection().updateOne({ _id: userId }, {
            $set: {
                accountStatus: 'deleted',
                email: `deleted_${userId}_${Date.now()}@deleted.com`,
                name: 'Deleted User',
                avatar: null,
                bio: null,
                location: null,
                website: null,
                socialLinks: null,
                updatedAt: new Date(),
            },
        });
        if (result.matchedCount === 0) {
            throw new NotFoundError('Profile not found');
        }
        // Remove from all followers/following lists
        await this.getCollection().updateMany({ $or: [{ followers: userId }, { following: userId }] }, {
            $pull: {
                followers: userId,
                following: userId,
            },
        });
        // TODO: Schedule data deletion after retention period
    }
    canViewContent(visibility, isFollower) {
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
UserProfileService.instance = null;
//# sourceMappingURL=user-profile.service.js.map
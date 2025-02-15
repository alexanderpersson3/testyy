import { ObjectId } from 'mongodb';
;
import { db, connectToDatabase } from '../db.js';
import logger from '../utils/logger.js';
import { generateToken } from '../utils/token.js';
import { hashPassword, verifyPassword } from '../utils/password.js';
import { sendShareEmail } from '../utils/email.js';
import { generateEmbedCode } from '../utils/embed.js';
import { Share, ShareWithDetails, ShareQuery, CreateShareDTO, UpdateShareDTO, ShareAccess, ShareResult, ShareStats, ShareMetrics, EmbedOptions, ShareChannel, SharePermission, } from '../types/sharing.js';
export class SharingService {
    constructor() { }
    static getInstance() {
        if (!SharingService.instance) {
            SharingService.instance = new SharingService();
        }
        return SharingService.instance;
    }
    /**
     * Create a new share
     */
    async createShare(recipeId, userId, data) {
        const db = await connectToDatabase();
        // Verify recipe exists and user has permission to share
        const recipe = await db.collection('recipes').findOne({
            _id: new ObjectId(recipeId),
            $or: [{ userId: new ObjectId(userId) }, { 'sharing.public': true }],
        });
        if (!recipe) {
            throw new Error('Recipe not found or not shareable');
        }
        // Generate unique share token
        const token = await generateToken();
        // Hash password if provided
        const hashedPassword = data.password ? await hashPassword(data.password) : undefined;
        const share = {
            recipeId: new ObjectId(recipeId),
            userId: new ObjectId(userId),
            channel: data.channel,
            permission: data.permission,
            token,
            isActive: true,
            expiresAt: data.expiresAt,
            maxUses: data.maxUses,
            useCount: 0,
            password: hashedPassword,
            allowedEmails: data.allowedEmails,
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        const result = await db.collection('shares').insertOne(share);
        const shareWithDetails = await this.getShareWithDetails(result.insertedId.toString());
        if (!shareWithDetails) {
            throw new Error('Failed to create share');
        }
        // Handle channel-specific actions
        const shareUrl = this.generateShareUrl(token);
        let embedCode;
        switch (data.channel) {
            case 'email':
                if (data.allowedEmails?.length) {
                    await Promise.all(data.allowedEmails.map(email => sendShareEmail(email, shareUrl, recipe.name, userId)));
                }
                break;
            case 'embed':
                embedCode = generateEmbedCode(shareUrl, {
                    width: '100%',
                    height: '600px',
                    responsive: true,
                });
                break;
        }
        // Track share creation
        await this.trackShareMetrics(result.insertedId, 'create');
        return {
            success: true,
            share: shareWithDetails,
            url: shareUrl,
            embedCode,
        };
    }
    /**
     * Update a share
     */
    async updateShare(shareId, userId, data) {
        const db = await connectToDatabase();
        const share = await db.collection('shares').findOne({
            _id: new ObjectId(shareId),
            userId: new ObjectId(userId),
        });
        if (!share) {
            throw new Error('Share not found or unauthorized');
        }
        const updateData = {
            ...data,
            updatedAt: new Date(),
        };
        if (data.password) {
            updateData.password = await hashPassword(data.password);
        }
        await db.collection('shares').updateOne({ _id: new ObjectId(shareId) }, { $set: updateData });
    }
    /**
     * Delete a share
     */
    async deleteShare(shareId, userId) {
        const db = await connectToDatabase();
        const result = await db.collection('shares').deleteOne({
            _id: new ObjectId(shareId),
            userId: new ObjectId(userId),
        });
        if (result.deletedCount === 0) {
            throw new Error('Share not found or unauthorized');
        }
    }
    /**
     * Get shares with optional filtering
     */
    async getShares(query) {
        const db = await connectToDatabase();
        const filter = {};
        if (query.recipeId) {
            filter.recipeId = new ObjectId(query.recipeId);
        }
        if (query.userId) {
            filter.userId = new ObjectId(query.userId);
        }
        if (query.channel) {
            filter.channel = query.channel;
        }
        if (typeof query.isActive === 'boolean') {
            filter.isActive = query.isActive;
        }
        const shares = (await db
            .collection('shares')
            .aggregate([
            { $match: filter },
            {
                $lookup: {
                    from: 'recipes',
                    localField: 'recipeId',
                    foreignField: '_id',
                    as: 'recipe',
                },
            },
            { $unwind: '$recipe' },
            {
                $lookup: {
                    from: 'users',
                    localField: 'userId',
                    foreignField: '_id',
                    as: 'user',
                },
            },
            { $unwind: '$user' },
            {
                $project: {
                    _id: 1,
                    recipeId: 1,
                    userId: 1,
                    channel: 1,
                    permission: 1,
                    token: 1,
                    isActive: 1,
                    expiresAt: 1,
                    maxUses: 1,
                    useCount: 1,
                    allowedEmails: 1,
                    createdAt: 1,
                    updatedAt: 1,
                    recipe: {
                        _id: 1,
                        name: 1,
                        imageUrl: 1,
                        description: 1,
                    },
                    user: {
                        _id: 1,
                        username: 1,
                        avatar: 1,
                    },
                },
            },
        ])
            .toArray());
        return shares;
    }
    /**
     * Access a shared recipe
     */
    async accessShare(access) {
        const db = await connectToDatabase();
        const share = await this.getShareWithDetails(access.token);
        if (!share) {
            return {
                success: false,
                error: {
                    code: 'not_found',
                    message: 'Share not found',
                },
            };
        }
        // Check if share is active and valid
        if (!share.isActive) {
            return {
                success: false,
                error: {
                    code: 'inactive',
                    message: 'This share is no longer active',
                },
            };
        }
        if (share.expiresAt && share.expiresAt < new Date()) {
            return {
                success: false,
                error: {
                    code: 'expired',
                    message: 'This share has expired',
                },
            };
        }
        if (share.maxUses && share.useCount >= share.maxUses) {
            return {
                success: false,
                error: {
                    code: 'max_uses',
                    message: 'This share has reached its maximum number of uses',
                },
            };
        }
        // Verify password if required
        if (share.password) {
            if (!access.password || !(await verifyPassword(access.password, share.password))) {
                return {
                    success: false,
                    error: {
                        code: 'invalid_password',
                        message: 'Invalid password',
                    },
                };
            }
        }
        // Verify email if restricted
        if (share.allowedEmails?.length) {
            if (!access.email || !share.allowedEmails.includes(access.email)) {
                return {
                    success: false,
                    error: {
                        code: 'invalid_email',
                        message: 'Email not authorized to access this share',
                    },
                };
            }
        }
        // Update use count
        await db.collection('shares').updateOne({ _id: share._id }, {
            $inc: { useCount: 1 },
            $set: { updatedAt: new Date() },
        });
        // Track share access
        await this.trackShareMetrics(share._id, 'access');
        return {
            success: true,
            share,
        };
    }
    /**
     * Get share statistics
     */
    async getShareStats(userId) {
        const db = await connectToDatabase();
        const shares = await db
            .collection('shares')
            .find({ userId: new ObjectId(userId) })
            .toArray();
        const stats = {
            totalShares: shares.length,
            activeShares: shares.filter(s => s.isActive).length,
            totalUses: shares.reduce((sum, s) => sum + s.useCount, 0),
            channelStats: {},
        };
        // Initialize channel stats
        const channels = [
            'link',
            'email',
            'facebook',
            'twitter',
            'pinterest',
            'whatsapp',
            'telegram',
            'embed',
        ];
        channels.forEach(channel => {
            stats.channelStats[channel] = {
                shares: 0,
                uses: 0,
            };
        });
        // Calculate channel stats
        shares.forEach(share => {
            stats.channelStats[share.channel].shares++;
            stats.channelStats[share.channel].uses += share.useCount;
        });
        return stats;
    }
    /**
     * Get share metrics
     */
    async getShareMetrics(shareId) {
        const db = await connectToDatabase();
        const metrics = (await db.collection('share_metrics').findOne({
            shareId: new ObjectId(shareId),
        })) || {
            shareId: new ObjectId(shareId),
            views: 0,
            uniqueVisitors: 0,
            shares: 0,
            engagement: {
                comments: 0,
                ratings: 0,
                forks: 0,
            },
            referrers: {},
        };
        return metrics;
    }
    /**
     * Get a share with full details
     */
    async getShareWithDetails(tokenOrId) {
        const db = await connectToDatabase();
        const filter = ObjectId.isValid(tokenOrId)
            ? { _id: new ObjectId(tokenOrId) }
            : { token: tokenOrId };
        const share = (await db
            .collection('shares')
            .aggregate([
            { $match: filter },
            {
                $lookup: {
                    from: 'recipes',
                    localField: 'recipeId',
                    foreignField: '_id',
                    as: 'recipe',
                },
            },
            { $unwind: '$recipe' },
            {
                $lookup: {
                    from: 'users',
                    localField: 'userId',
                    foreignField: '_id',
                    as: 'user',
                },
            },
            { $unwind: '$user' },
            {
                $project: {
                    _id: 1,
                    recipeId: 1,
                    userId: 1,
                    channel: 1,
                    permission: 1,
                    token: 1,
                    isActive: 1,
                    expiresAt: 1,
                    maxUses: 1,
                    useCount: 1,
                    password: 1,
                    allowedEmails: 1,
                    createdAt: 1,
                    updatedAt: 1,
                    recipe: {
                        _id: 1,
                        name: 1,
                        imageUrl: 1,
                        description: 1,
                    },
                    user: {
                        _id: 1,
                        username: 1,
                        avatar: 1,
                    },
                },
            },
        ])
            .next());
        return share;
    }
    /**
     * Generate share URL
     */
    generateShareUrl(token) {
        const baseUrl = process.env.APP_URL || 'http://localhost:3000';
        return `${baseUrl}/shared/${token}`;
    }
    /**
     * Track share metrics
     */
    async trackShareMetrics(shareId, action, details) {
        const db = await connectToDatabase();
        const update = {
            $inc: {},
            $set: { updatedAt: new Date() },
        };
        switch (action) {
            case 'create':
                update.$inc.shares = 1;
                break;
            case 'access':
                update.$inc.views = 1;
                if (details?.referrer) {
                    update.$inc[`referrers.${details.referrer}`] = 1;
                }
                break;
            case 'engage':
                if (details?.type) {
                    update.$inc[`engagement.${details.type}`] = 1;
                }
                break;
        }
        await db.collection('share_metrics').updateOne({ shareId }, update, { upsert: true });
    }
}
//# sourceMappingURL=sharing.service.js.map
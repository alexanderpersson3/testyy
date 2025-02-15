import { ObjectId } from 'mongodb';
;
import { DatabaseService } from '../db/database.service.js';
import { UserProfile } from '../types/user.js';
import { Subscription, SubscriptionStatusType, SubscriptionType } from '../types/subscription.js';
// Map subscription status to user-facing status
const mapSubscriptionStatus = (status) => {
    switch (status) {
        case 'active':
            return 'active';
        case 'expired':
        case 'inactive':
            return 'inactive';
        case 'cancelled':
            return 'cancelled';
        default:
            return 'inactive';
    }
};
export class SubscriptionManager {
    constructor() {
        this.db = DatabaseService.getInstance();
    }
    static getInstance() {
        if (!SubscriptionManager.instance) {
            SubscriptionManager.instance = new SubscriptionManager();
        }
        return SubscriptionManager.instance;
    }
    formatSubscription(subscription) {
        const now = new Date();
        return {
            ...subscription,
            _id: subscription._id || new ObjectId(),
            status: mapSubscriptionStatus(subscription.status),
            createdAt: subscription.createdAt || now,
            updatedAt: subscription.updatedAt || now,
            userId: subscription.userId || new ObjectId(),
            plan: subscription.plan || 'free',
            startDate: subscription.startDate || now,
            expiresAt: subscription.expiresAt || new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
            autoRenew: subscription.autoRenew || false,
            features: subscription.features || []
        };
    }
    async getSubscription(userId) {
        const result = await this.db
            .getCollection('subscriptions')
            .findOne({ userId: new ObjectId(userId) });
        if (!result)
            return undefined;
        return this.formatSubscription(result);
    }
    async createSubscription(userId, plan) {
        try {
            const now = new Date();
            const doc = {
                _id: new ObjectId(),
                userId: new ObjectId(userId),
                plan,
                status: 'active',
                startDate: now,
                expiresAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
                autoRenew: true,
                features: [],
                createdAt: now,
                updatedAt: now
            };
            const result = await this.db
                .getCollection('subscriptions')
                .insertOne(doc);
            const subscription = this.formatSubscription(doc);
            await this.db.getCollection('users').updateOne({ _id: new ObjectId(userId) }, {
                $set: {
                    subscription,
                    updatedAt: now,
                },
            });
        }
        catch (error) {
            throw new Error(`Failed to create subscription: ${error}`);
        }
    }
    async updateSubscription(userId, updates) {
        try {
            const result = await this.db.getCollection('subscriptions').findOneAndUpdate({ userId: new ObjectId(userId) }, {
                $set: {
                    ...updates,
                    updatedAt: new Date(),
                },
            }, { returnDocument: 'after' });
            if (!result.value) {
                throw new Error('User not found or subscription not updated');
            }
            await this.db.getCollection('users').updateOne({ _id: new ObjectId(userId) }, {
                $set: {
                    subscription: this.formatSubscription(result.value),
                    updatedAt: new Date(),
                },
            });
        }
        catch (error) {
            throw new Error(`Failed to update subscription: ${error}`);
        }
    }
    async cancelSubscription(userId) {
        try {
            await this.db.getCollection('subscriptions').updateOne({ userId: new ObjectId(userId) }, {
                $set: {
                    status: 'cancelled',
                    cancelledAt: new Date(),
                    updatedAt: new Date(),
                },
            });
        }
        catch (error) {
            throw new Error(`Failed to cancel subscription: ${error}`);
        }
    }
    async checkSubscriptionStatus(userId) {
        try {
            const user = await this.db
                .getCollection('users')
                .findOne({ _id: new ObjectId(userId) });
            if (!user?.subscription) {
                return false;
            }
            return (user.subscription.status === 'active' && new Date() < new Date(user.subscription.expiresAt));
        }
        catch (error) {
            throw new Error(`Failed to check subscription status: ${error}`);
        }
    }
    async renewSubscription(userId, months) {
        try {
            const user = await this.db
                .getCollection('users')
                .findOne({ _id: new ObjectId(userId) });
            if (!user?.subscription) {
                throw new Error('No subscription found to renew');
            }
            const newExpiryDate = new Date(user.subscription.expiresAt);
            newExpiryDate.setMonth(newExpiryDate.getMonth() + months);
            await this.updateSubscription(userId, {
                expiresAt: newExpiryDate,
                status: 'active',
                updatedAt: new Date(),
            });
        }
        catch (error) {
            throw new Error(`Failed to renew subscription: ${error}`);
        }
    }
    async pauseSubscription(userId) {
        try {
            await this.db.getCollection('subscriptions').updateOne({ userId: new ObjectId(userId) }, {
                $set: {
                    status: 'inactive',
                    updatedAt: new Date(),
                },
            });
        }
        catch (error) {
            throw new Error(`Failed to pause subscription: ${error}`);
        }
    }
    async resumeSubscription(userId) {
        try {
            const user = await this.db
                .getCollection('users')
                .findOne({ _id: new ObjectId(userId) });
            if (!user?.subscription) {
                throw new Error('No subscription found to resume');
            }
            await this.updateSubscription(userId, {
                status: 'active',
                updatedAt: new Date(),
            });
        }
        catch (error) {
            throw new Error(`Failed to resume subscription: ${error}`);
        }
    }
}
//# sourceMappingURL=subscription-manager.js.map
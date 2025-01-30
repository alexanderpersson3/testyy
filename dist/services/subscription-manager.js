import { getDb } from '../config/db';
import { ObjectId } from 'mongodb';
import { UserRole } from '../types/user';
export default class SubscriptionManager {
    constructor() {
        this.SUBSCRIPTION_TYPES = {
            FREE: 'free',
            PREMIUM: 'premium',
            ENTERPRISE: 'enterprise'
        };
        this.FEATURES = {
            free: ['basic_recipes', 'basic_search'],
            premium: ['advanced_recipes', 'advanced_search', 'meal_planning', 'price_tracking'],
            enterprise: ['all_features', 'api_access', 'custom_integrations']
        };
        this.featureMap = new Map([
            ['offline_access', [UserRole.PREMIUM, UserRole.ADMIN]],
            ['advanced_search', [UserRole.PREMIUM, UserRole.ADMIN]],
            ['recipe_collections', [UserRole.PREMIUM, UserRole.ADMIN]],
            ['meal_planning', [UserRole.PREMIUM, UserRole.ADMIN]]
        ]);
    }
    static getInstance() {
        if (!SubscriptionManager.instance) {
            SubscriptionManager.instance = new SubscriptionManager();
        }
        return SubscriptionManager.instance;
    }
    async hasFeatureAccess(userId, feature) {
        try {
            const db = await getDb();
            const user = await db.collection('users').findOne({
                _id: new ObjectId(userId)
            });
            if (!user) {
                return false;
            }
            const allowedRoles = this.featureMap.get(feature);
            if (!allowedRoles) {
                return false;
            }
            return allowedRoles.includes(user.role);
        }
        catch (error) {
            console.error('Error checking feature access:', error);
            return false;
        }
    }
    async upgradeToRole(userId, newRole) {
        try {
            const db = await getDb();
            const result = await db.collection('users').updateOne({ _id: new ObjectId(userId) }, {
                $set: {
                    role: newRole,
                    updatedAt: new Date()
                }
            });
            return result.modifiedCount > 0;
        }
        catch (error) {
            console.error('Error upgrading user role:', error);
            return false;
        }
    }
    async getUserFeatures(userId) {
        try {
            const db = await getDb();
            const user = await db.collection('users').findOne({
                _id: new ObjectId(userId)
            });
            if (!user) {
                return [];
            }
            return Array.from(this.featureMap.entries())
                .filter(([_, roles]) => roles.includes(user.role))
                .map(([feature]) => feature);
        }
        catch (error) {
            console.error('Error getting user features:', error);
            return [];
        }
    }
    async hasPremiumAccess(userId, feature) {
        try {
            const details = await this.getSubscriptionDetails(userId);
            const allowedFeatures = this.FEATURES[details.subscriptionType];
            return allowedFeatures.includes(feature) ||
                allowedFeatures.includes('all_features') ||
                this.isInTrialPeriod(details);
        }
        catch (err) {
            console.error('Error checking premium access:', err);
            return false;
        }
    }
    async getSubscriptionDetails(userId) {
        const db = await getDb();
        const user = await db.collection('users').findOne({ _id: new ObjectId(userId) }, { projection: { subscription: 1 } });
        if (!user?.subscription) {
            return {
                subscriptionType: this.SUBSCRIPTION_TYPES.FREE,
                hasUsedTrial: false
            };
        }
        return user.subscription;
    }
    isInTrialPeriod(details) {
        if (!details.trialStartDate || !details.trialEndDate || details.hasUsedTrial) {
            return false;
        }
        const now = new Date();
        return now >= details.trialStartDate && now <= details.trialEndDate;
    }
    async startTrial(userId) {
        const db = await getDb();
        const details = await this.getSubscriptionDetails(userId);
        if (details.hasUsedTrial) {
            throw new Error('User has already used their trial period');
        }
        const trialStartDate = new Date();
        const trialEndDate = new Date();
        trialEndDate.setDate(trialEndDate.getDate() + 14); // 14-day trial
        const subscription = {
            subscriptionType: this.SUBSCRIPTION_TYPES.PREMIUM,
            trialStartDate,
            trialEndDate,
            hasUsedTrial: true
        };
        await db.collection('users').updateOne({ _id: new ObjectId(userId) }, { $set: { subscription } });
        return subscription;
    }
    async updateSubscription(userId, subscriptionType) {
        if (!Object.values(this.SUBSCRIPTION_TYPES).includes(subscriptionType)) {
            throw new Error('Invalid subscription type');
        }
        const db = await getDb();
        const subscription = {
            subscriptionType,
            hasUsedTrial: true
        };
        await db.collection('users').updateOne({ _id: new ObjectId(userId) }, { $set: { subscription } });
        return subscription;
    }
}
//# sourceMappingURL=subscription-manager.js.map
import { getDb } from '../config/db';
import { ObjectId } from 'mongodb';
import { UserProfile, UserRole } from '../types/user';

export interface SubscriptionTypes {
  FREE: string;
  PREMIUM: string;
  ENTERPRISE: string;
}

export interface SubscriptionFeatures {
  [key: string]: string[];
}

export interface SubscriptionDetails {
  subscriptionType: string;
  trialStartDate?: Date;
  trialEndDate?: Date;
  hasUsedTrial: boolean;
}

export default class SubscriptionManager {
  private static instance: SubscriptionManager;
  private readonly featureMap: Map<string, UserRole[]>;

  private constructor() {
    this.featureMap = new Map([
      ['offline_access', [UserRole.PREMIUM, UserRole.ADMIN]],
      ['advanced_search', [UserRole.PREMIUM, UserRole.ADMIN]],
      ['recipe_collections', [UserRole.PREMIUM, UserRole.ADMIN]],
      ['meal_planning', [UserRole.PREMIUM, UserRole.ADMIN]]
    ]);
  }

  public static getInstance(): SubscriptionManager {
    if (!SubscriptionManager.instance) {
      SubscriptionManager.instance = new SubscriptionManager();
    }
    return SubscriptionManager.instance;
  }

  public async hasFeatureAccess(userId: string, feature: string): Promise<boolean> {
    try {
      const db = await getDb();
      const user = await db.collection<UserProfile>('users').findOne({
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
    } catch (error) {
      console.error('Error checking feature access:', error);
      return false;
    }
  }

  public async upgradeToRole(userId: string, newRole: UserRole): Promise<boolean> {
    try {
      const db = await getDb();
      const result = await db.collection<UserProfile>('users').updateOne(
        { _id: new ObjectId(userId) },
        { 
          $set: { 
            role: newRole,
            updatedAt: new Date()
          }
        }
      );

      return result.modifiedCount > 0;
    } catch (error) {
      console.error('Error upgrading user role:', error);
      return false;
    }
  }

  public async getUserFeatures(userId: string): Promise<string[]> {
    try {
      const db = await getDb();
      const user = await db.collection<UserProfile>('users').findOne({
        _id: new ObjectId(userId)
      });

      if (!user) {
        return [];
      }

      return Array.from(this.featureMap.entries())
        .filter(([_, roles]) => roles.includes(user.role))
        .map(([feature]) => feature);
    } catch (error) {
      console.error('Error getting user features:', error);
      return [];
    }
  }

  public readonly SUBSCRIPTION_TYPES: SubscriptionTypes = {
    FREE: 'free',
    PREMIUM: 'premium',
    ENTERPRISE: 'enterprise'
  };

  private readonly FEATURES: SubscriptionFeatures = {
    free: ['basic_recipes', 'basic_search'],
    premium: ['advanced_recipes', 'advanced_search', 'meal_planning', 'price_tracking'],
    enterprise: ['all_features', 'api_access', 'custom_integrations']
  };

  async hasPremiumAccess(userId: string, feature: string): Promise<boolean> {
    try {
      const details = await this.getSubscriptionDetails(userId);
      const allowedFeatures = this.FEATURES[details.subscriptionType];
      
      return allowedFeatures.includes(feature) || 
             allowedFeatures.includes('all_features') ||
             this.isInTrialPeriod(details);
    } catch (err) {
      console.error('Error checking premium access:', err);
      return false;
    }
  }

  async getSubscriptionDetails(userId: string): Promise<SubscriptionDetails> {
    const db = await getDb();
    const user = await db.collection('users').findOne(
      { _id: new ObjectId(userId) },
      { projection: { subscription: 1 } }
    );

    if (!user?.subscription) {
      return {
        subscriptionType: this.SUBSCRIPTION_TYPES.FREE,
        hasUsedTrial: false
      };
    }

    return user.subscription;
  }

  private isInTrialPeriod(details: SubscriptionDetails): boolean {
    if (!details.trialStartDate || !details.trialEndDate || details.hasUsedTrial) {
      return false;
    }

    const now = new Date();
    return now >= details.trialStartDate && now <= details.trialEndDate;
  }

  async startTrial(userId: string): Promise<SubscriptionDetails> {
    const db = await getDb();
    const details = await this.getSubscriptionDetails(userId);

    if (details.hasUsedTrial) {
      throw new Error('User has already used their trial period');
    }

    const trialStartDate = new Date();
    const trialEndDate = new Date();
    trialEndDate.setDate(trialEndDate.getDate() + 14); // 14-day trial

    const subscription: SubscriptionDetails = {
      subscriptionType: this.SUBSCRIPTION_TYPES.PREMIUM,
      trialStartDate,
      trialEndDate,
      hasUsedTrial: true
    };

    await db.collection('users').updateOne(
      { _id: new ObjectId(userId) },
      { $set: { subscription } }
    );

    return subscription;
  }

  async updateSubscription(
    userId: string,
    subscriptionType: string
  ): Promise<SubscriptionDetails> {
    if (!Object.values(this.SUBSCRIPTION_TYPES).includes(subscriptionType)) {
      throw new Error('Invalid subscription type');
    }

    const db = await getDb();
    const subscription: SubscriptionDetails = {
      subscriptionType,
      hasUsedTrial: true
    };

    await db.collection('users').updateOne(
      { _id: new ObjectId(userId) },
      { $set: { subscription } }
    );

    return subscription;
  }
} 
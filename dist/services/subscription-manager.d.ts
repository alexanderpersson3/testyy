import { UserRole } from '../types/user';
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
    private static instance;
    private readonly featureMap;
    private constructor();
    static getInstance(): SubscriptionManager;
    hasFeatureAccess(userId: string, feature: string): Promise<boolean>;
    upgradeToRole(userId: string, newRole: UserRole): Promise<boolean>;
    getUserFeatures(userId: string): Promise<string[]>;
    readonly SUBSCRIPTION_TYPES: SubscriptionTypes;
    private readonly FEATURES;
    hasPremiumAccess(userId: string, feature: string): Promise<boolean>;
    getSubscriptionDetails(userId: string): Promise<SubscriptionDetails>;
    private isInTrialPeriod;
    startTrial(userId: string): Promise<SubscriptionDetails>;
    updateSubscription(userId: string, subscriptionType: string): Promise<SubscriptionDetails>;
}
//# sourceMappingURL=subscription-manager.d.ts.map
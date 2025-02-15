import { Subscription, SubscriptionType } from '../types/subscription.js';
export declare class SubscriptionManager {
    private static instance;
    private db;
    private constructor();
    static getInstance(): SubscriptionManager;
    private formatSubscription;
    getSubscription(userId: string): Promise<Subscription | undefined>;
    createSubscription(userId: string, plan: SubscriptionType): Promise<void>;
    updateSubscription(userId: string, updates: Partial<Subscription>): Promise<void>;
    cancelSubscription(userId: string): Promise<void>;
    checkSubscriptionStatus(userId: string): Promise<boolean>;
    renewSubscription(userId: string, months: number): Promise<void>;
    pauseSubscription(userId: string): Promise<void>;
    resumeSubscription(userId: string): Promise<void>;
}

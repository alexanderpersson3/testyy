import { ObjectId } from 'mongodb';
import type { MongoDocument } from '../types/index.js';
export type SubscriptionTier = 'free' | 'premium' | 'pro';
export type SubscriptionStatus = 'active' | 'canceled' | 'expired' | 'pending' | 'failed';
export type PaymentProvider = 'stripe' | 'apple' | 'google';
export type BillingInterval = 'monthly' | 'yearly';
export interface SubscriptionPlan {
    _id?: ObjectId;
    name: string;
    tier: SubscriptionTier;
    description: string;
    features: string[];
    pricing: {
        [key in BillingInterval]: {
            amount: number;
            currency: string;
            trialDays?: number;
        };
    };
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}
export interface SubscriptionPlanDocument extends SubscriptionPlan {
    _id: ObjectId;
}
export interface UserSubscription {
    _id?: ObjectId;
    userId: ObjectId;
    planId: ObjectId;
    status: SubscriptionStatus;
    tier: SubscriptionTier;
    billingInterval: BillingInterval;
    startDate: Date;
    endDate: Date;
    trialEndsAt?: Date;
    canceledAt?: Date;
    provider: PaymentProvider;
    providerSubscriptionId: string;
    providerCustomerId: string;
    currentPeriodStart: Date;
    currentPeriodEnd: Date;
    lastPayment?: {
        amount: number;
        currency: string;
        date: Date;
        status: 'succeeded' | 'failed' | 'pending';
    };
    metadata?: {
        promotionCode?: string;
        referralCode?: string;
        platform?: string;
    };
    createdAt: Date;
    updatedAt: Date;
}
export interface UserSubscriptionDocument extends UserSubscription {
    _id: ObjectId;
}
export interface SubscriptionFeatureAccess {
    offlineAccess: boolean;
    advancedFilters: boolean;
    mealPlanning: boolean;
    nutritionTracking: boolean;
    adFree: boolean;
    customCollections: boolean;
    prioritySupport: boolean;
    exclusiveContent: boolean;
    maxRecipeStorage: number;
    maxCollections: number;
    maxShoppingLists: number;
}
export interface PaymentMethod {
    _id?: ObjectId;
    userId: ObjectId;
    provider: PaymentProvider;
    providerPaymentMethodId: string;
    type: 'card' | 'bank_account' | 'wallet';
    details: {
        brand?: string;
        last4?: string;
        expiryMonth?: number;
        expiryYear?: number;
        country?: string;
    };
    isDefault: boolean;
    createdAt: Date;
    updatedAt: Date;
}
export interface PaymentMethodDocument extends PaymentMethod {
    _id: ObjectId;
}
export interface SubscriptionInvoice {
    _id?: ObjectId;
    userId: ObjectId;
    subscriptionId: ObjectId;
    amount: number;
    currency: string;
    status: 'draft' | 'open' | 'paid' | 'void' | 'uncollectible';
    billingReason: 'subscription_create' | 'subscription_cycle' | 'subscription_update';
    periodStart: Date;
    periodEnd: Date;
    paidAt?: Date;
    paymentMethodId?: ObjectId;
    pdf?: string;
    createdAt: Date;
    updatedAt: Date;
}
export interface SubscriptionInvoiceDocument extends SubscriptionInvoice {
    _id: ObjectId;
}
export interface PromotionCode {
    _id?: ObjectId;
    code: string;
    description: string;
    discountType: 'percentage' | 'fixed_amount';
    discountAmount: number;
    currency?: string;
    maxRedemptions?: number;
    currentRedemptions: number;
    validFrom: Date;
    validUntil?: Date;
    restrictions?: {
        minimumAmount?: number;
        subscriptionTiers?: SubscriptionTier[];
        newCustomersOnly?: boolean;
    };
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}
export type SubscriptionType = 'free' | 'premium' | 'pro';
export type SubscriptionStatusType = 'active' | 'inactive' | 'cancelled' | 'expired';
export interface Subscription extends MongoDocument {
    userId: ObjectId;
    plan: SubscriptionType;
    status: SubscriptionStatusType;
    startDate: Date;
    expiresAt: Date;
    autoRenew: boolean;
    features: string[];
    updatedAt: Date;
    paymentMethod?: {
        type: string;
        lastFour?: string;
        expiryDate?: string;
    };
    billingInfo?: {
        address: string;
        city: string;
        country: string;
        postalCode: string;
    };
}
export interface UserWithSubscription {
    _id: ObjectId;
    email: string;
    roles: string[];
    subscription?: Subscription;
    preferences?: Record<string, any>;
}
export interface SubscriptionFeature {
    id: string;
    name: string;
    description: string;
    requiredPlan: SubscriptionType;
    enabled: boolean;
}
export interface SubscriptionPlanDetails {
    id: SubscriptionType;
    name: string;
    price: number;
    interval: 'month' | 'year';
    features: string[];
    description: string;
}

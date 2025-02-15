import { ObjectId } from 'mongodb';

export enum Platform {
  ANDROID = 'android',
  IOS = 'ios'
}

export enum SubscriptionStatus {
  ACTIVE = 'active',
  EXPIRED = 'expired',
  CANCELED = 'canceled',
  GRACE_PERIOD = 'grace_period',
  ON_HOLD = 'on_hold'
}

export enum SubscriptionTier {
  FREE = 'free',
  BASIC = 'basic',
  PREMIUM = 'premium',
  PROFESSIONAL = 'professional'
}

export interface TierLimits {
  recipes_per_month: number;
  meal_plans: number;
  price_alerts: number;
  collections: number;
  advanced_search: boolean;
  ad_free: boolean;
}

export interface AndroidPurchaseData {
  packageName: string;
  subscriptionId: string;
  purchaseToken: string;
}

export interface IosPurchaseData {
  receiptData: string;
}

export type PurchaseData = AndroidPurchaseData | IosPurchaseData;

export interface AndroidValidationResult {
  isValid: boolean;
  expiryDate: Date;
  autoRenewing: boolean;
  purchaseState: number;
}

export interface IosValidationResult {
  isValid: boolean;
  expiryDate: Date;
  autoRenewing: boolean;
  productId: string;
  originalTransactionId: string;
}

export interface Subscription {
  _id?: ObjectId;
  user_id: ObjectId;
  platform: Platform;
  product_id: string;
  purchase_token: string;
  status: SubscriptionStatus;
  expiry_date: Date;
  auto_renewing: boolean;
  tier: SubscriptionTier;
  created_at: Date;
  updated_at: Date;
}

export interface SubscriptionLog {
  _id?: ObjectId;
  user_id: ObjectId;
  platform: Platform;
  product_id: string;
  old_status: SubscriptionStatus;
  new_status: SubscriptionStatus;
  old_tier: SubscriptionTier;
  new_tier: SubscriptionTier;
  timestamp: Date;
}

export interface FeatureUsage {
  _id?: ObjectId;
  user_id: ObjectId;
  recipes_created: number;
  meal_plans_created: number;
  price_alerts_set: number;
  collections_created: number;
  last_reset: Date;
}

export interface SubscriptionDetails {
  isActive: boolean;
  tier: SubscriptionTier;
  expiryDate?: Date;
  autoRenewing: boolean;
  limits: TierLimits;
  usage: FeatureUsage;
}

export interface GooglePlayNotification {
  data: string; // base64 encoded JSON
}

export interface AppStoreNotification {
  latest_receipt: string;
  notification_type: string;
  environment: 'Sandbox' | 'Production';
}

export interface ProductTierMapping {
  [key: string]: SubscriptionTier;
} 
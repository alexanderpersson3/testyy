import { ObjectId } from 'mongodb';
import { ActivityType } from './social';

export type NotificationChannel = 'push' | 'email' | 'in_app';
export type NotificationStatus = 'pending' | 'sent' | 'failed' | 'read';
export type NotificationPriority = 'low' | 'medium' | 'high';

export interface NotificationPreferences {
  userId: ObjectId;
  channels: {
    [key in ActivityType]: NotificationChannel[];
  };
  pushEnabled: boolean;
  emailEnabled: boolean;
  pushTokens: Array<{
    token: string;
    platform: 'ios' | 'android' | 'web';
    lastUsed: Date;
  }>;
  quietHours?: {
    start: string; // HH:mm format
    end: string; // HH:mm format
    timezone: string;
  };
  updatedAt: Date;
}

export interface Notification {
  _id?: ObjectId;
  userId: ObjectId;
  title: string;
  body: string;
  activityType: ActivityType;
  channels: NotificationChannel[];
  priority: NotificationPriority;
  status: NotificationStatus;
  metadata?: {
    activityId?: ObjectId;
    recipeId?: ObjectId;
    userId?: ObjectId;
    dealId?: ObjectId;
    imageUrl?: string;
    deepLink?: string;
  };
  readAt?: Date;
  sentAt?: Date;
  createdAt: Date;
}

export interface NotificationDocument extends Notification {
  _id: ObjectId;
}

export interface NotificationBatch {
  _id?: ObjectId;
  title: string;
  body: string;
  activityType: ActivityType;
  channels: NotificationChannel[];
  priority: NotificationPriority;
  filters?: {
    userIds?: ObjectId[];
    countries?: string[];
    languages?: string[];
    subscriptionTypes?: string[];
    lastActiveAfter?: Date;
    lastActiveBefore?: Date;
  };
  status: 'draft' | 'scheduled' | 'sending' | 'completed' | 'failed';
  scheduledFor?: Date;
  stats?: {
    total: number;
    sent: number;
    failed: number;
    read: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface NotificationBatchDocument extends NotificationBatch {
  _id: ObjectId;
}

export interface NotificationQueryOptions {
  userId: ObjectId;
  status?: NotificationStatus[];
  activityTypes?: ActivityType[];
  startDate?: Date;
  endDate?: Date;
  unreadOnly?: boolean;
  limit?: number;
  offset?: number;
} 
import { ObjectId } from 'mongodb';;;;
import { ActivityType } from '../social.js';;

export type NotificationPriority = 'low' | 'medium' | 'high';

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

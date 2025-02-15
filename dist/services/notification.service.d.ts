import { ObjectId } from 'mongodb';
import { Notification, NotificationType, NotificationChannel, NotificationPreferences, NotificationStatus } from '../types/index.js';
export declare class NotificationService {
    private static instance;
    private wsService;
    private emailService;
    private pushService;
    private constructor();
    static getInstance(): NotificationService;
    /**
     * Create a new notification
     */
    create(userId: ObjectId, type: NotificationType, title: string, message: string, data?: Record<string, any>, channels?: NotificationChannel[]): Promise<Notification>;
    /**
     * Create batch notifications for multiple users
     */
    createBatch(userIds: ObjectId[], type: NotificationType, title: string, message: string, data?: Record<string, any>, channels?: NotificationChannel[]): Promise<number>;
    /**
     * Send notification through specified channel
     */
    private send;
    /**
     * Send in-app notification
     */
    private sendInApp;
    /**
     * Send email notification
     */
    private sendEmail;
    /**
     * Send push notification
     */
    private sendPush;
    /**
     * Send SMS notification
     */
    private sendSMS;
    /**
     * Update notification status
     */
    private updateStatus;
    /**
     * Get user's notifications with advanced filtering
     */
    getNotifications(userId: ObjectId, options?: {
        unreadOnly?: boolean;
        types?: NotificationType[];
        channels?: NotificationChannel[];
        limit?: number;
        before?: Date;
        after?: Date;
        status?: NotificationStatus;
    }): Promise<Notification[]>;
    /**
     * Mark notification as read
     */
    markAsRead(notificationId: ObjectId, userId: ObjectId): Promise<void>;
    /**
     * Mark all notifications as read
     */
    markAllAsRead(userId: ObjectId): Promise<number>;
    /**
     * Get notification preferences
     */
    getPreferences(userId: ObjectId): Promise<NotificationPreferences | null>;
    /**
     * Update notification preferences
     */
    updatePreferences(userId: ObjectId, preferences: Partial<Omit<NotificationPreferences, '_id' | 'userId'>>): Promise<NotificationPreferences>;
    /**
     * Dismiss notification (mark as dismissed without deleting)
     */
    dismissNotification(notificationId: ObjectId, userId: ObjectId): Promise<boolean>;
    /**
     * Delete notification
     */
    deleteNotification(notificationId: ObjectId, userId: ObjectId): Promise<boolean>;
    /**
     * Delete old notifications
     */
    deleteOldNotifications(olderThan: Date): Promise<number>;
}

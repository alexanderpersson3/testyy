import { ObjectId } from 'mongodb';
import { NotificationType, NotificationChannel } from '../types/index.js';
interface CreateNotificationInput {
    userId: ObjectId;
    type: NotificationType;
    title: string;
    message: string;
    data?: Record<string, any>;
    channels?: NotificationChannel[];
}
export declare class NotificationManagerService {
    private static instance;
    private notificationService;
    private wsService;
    private emailService;
    private constructor();
    static getInstance(): NotificationManagerService;
    /**
     * Send a notification
     */
    sendNotification(input: CreateNotificationInput): Promise<void>;
    /**
     * Send digest notifications
     */
    sendDigests(): Promise<void>;
    /**
     * Check if current time is in quiet hours
     */
    private isInQuietHours;
    /**
     * Group notifications by type
     */
    private groupNotifications;
    /**
     * Generate digest content
     */
    private generateDigestContent;
    /**
     * Format notification type for display
     */
    private formatNotificationType;
}
export {};

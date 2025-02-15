import { NotificationStatus } from '../types/index.js';
interface PushToken {
    _id?: ObjectId;
    userId: ObjectId;
    token: string;
    platform: 'ios' | 'android' | 'web';
    deviceId: string;
    createdAt: Date;
    updatedAt: Date;
    lastUsed: Date;
}
interface PushNotification {
    title: string;
    body: string;
    data?: Record<string, any>;
    image?: string;
    badge?: number;
    sound?: string;
    priority?: 'default' | 'high';
    ttl?: number;
}
export declare class PushNotificationService {
    private static instance;
    private constructor();
    static getInstance(): PushNotificationService;
    /**
     * Register a push token for a user
     */
    registerToken(userId: ObjectId, token: string, platform: PushToken['platform'], deviceId: string): Promise<void>;
    /**
     * Send a push notification to a user
     */
    sendToUser(userId: ObjectId, notification: PushNotification): Promise<NotificationStatus>;
    /**
     * Send notification to a specific token
     */
    private sendToToken;
    /**
     * Unregister a push token
     */
    unregisterToken(userId: ObjectId, deviceId: string): Promise<void>;
    /**
     * Clean up old/unused tokens
     */
    cleanupTokens(olderThan: Date): Promise<number>;
}
export {};

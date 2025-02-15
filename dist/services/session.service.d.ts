import { ObjectId } from 'mongodb';
import { UserSession, DeviceAuthorization, DeviceType } from '../types/security.js';
export declare class SessionService {
    private static instance;
    private notificationService;
    private auditService;
    private constructor();
    static getInstance(): SessionService;
    /**
     * Create a new session
     */
    createSession(userId: ObjectId, deviceInfo: {
        type: DeviceType;
        name: string;
        os: string;
        browser: string;
        ip: string;
        userAgent: string;
    }): Promise<UserSession>;
    /**
     * Get active session by token
     */
    getSessionByToken(token: string): Promise<UserSession | null>;
    /**
     * Get user's active sessions
     */
    getActiveSessions(userId: ObjectId): Promise<UserSession[]>;
    /**
     * Revoke a session
     */
    revokeSession(sessionId: ObjectId, userId: ObjectId, deviceInfo: any): Promise<void>;
    /**
     * Revoke all sessions except current
     */
    revokeOtherSessions(userId: ObjectId, currentSessionId: ObjectId, deviceInfo: any): Promise<void>;
    /**
     * Check if device is new for user
     */
    private isNewDevice;
    /**
     * Clean up expired sessions
     */
    cleanupExpiredSessions(): Promise<void>;
    /**
     * Authorize device
     */
    authorizeDevice(userId: ObjectId, deviceInfo: {
        type: DeviceType;
        name: string;
        os: string;
        browser: string;
        ip: string;
        userAgent: string;
    }, trusted?: boolean): Promise<DeviceAuthorization>;
    /**
     * Revoke device authorization
     */
    revokeDevice(userId: ObjectId, deviceId: string, deviceInfo: any): Promise<void>;
    /**
     * Get user's authorized devices
     */
    getAuthorizedDevices(userId: ObjectId): Promise<DeviceAuthorization[]>;
}

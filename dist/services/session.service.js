import * as fs from 'fs';
import { ObjectId } from 'mongodb';
;
import { connectToDatabase } from '../db.js';
import logger from '../utils/logger.js';
import { NotificationManagerService } from '../notification-manager.service.js';
import { SecurityAuditService } from '../security-audit.service.js';
import { generateToken } from '../utils/crypto.js';
import { getLocationFromIP } from '../utils/geo.js';
import { UserSession, DeviceAuthorization, SecurityPreferences, DeviceType, SessionStatus, SecurityAction, } from '../types/security.js';
import { NotificationChannel } from '../types.js';
export class SessionService {
    constructor() {
        this.notificationService = NotificationManagerService.getInstance();
        this.auditService = SecurityAuditService.getInstance();
    }
    static getInstance() {
        if (!SessionService.instance) {
            SessionService.instance = new SessionService();
        }
        return SessionService.instance;
    }
    /**
     * Create a new session
     */
    async createSession(userId, deviceInfo) {
        const db = await connectToDatabase();
        // Get user's security preferences
        const prefs = await db
            .collection('security_preferences')
            .findOne({ userId });
        // Check active session limit
        if (prefs?.maxActiveSessions) {
            const activeSessions = await db.collection('user_sessions').countDocuments({
                userId,
                status: 'active',
            });
            if (activeSessions >= prefs.maxActiveSessions) {
                throw new Error('Maximum number of active sessions reached');
            }
        }
        // Check IP restrictions
        if (prefs?.allowedIPs?.length && !prefs.allowedIPs.includes(deviceInfo.ip)) {
            throw new Error('Access from this IP address is not allowed');
        }
        if (prefs?.blockedIPs?.length && prefs.blockedIPs.includes(deviceInfo.ip)) {
            throw new Error('Access from this IP address is blocked');
        }
        // Get location info
        const location = await getLocationFromIP(deviceInfo.ip);
        // Check country restrictions
        if (prefs?.allowedCountries?.length &&
            location?.country &&
            !prefs.allowedCountries.includes(location.country)) {
            throw new Error('Access from this country is not allowed');
        }
        if (prefs?.blockedCountries?.length &&
            location?.country &&
            prefs.blockedCountries.includes(location.country)) {
            throw new Error('Access from this country is blocked');
        }
        const now = new Date();
        const session = {
            _id: new ObjectId(),
            userId,
            token: generateToken(32),
            status: 'active',
            deviceInfo,
            location,
            lastActive: now,
            expiresAt: new Date(now.getTime() + (prefs?.sessionTimeout || 24 * 60) * 60 * 1000),
            createdAt: now,
            updatedAt: now,
        };
        await db.collection('user_sessions').insertOne(session);
        // Check if this is a new device
        const isNewDevice = await this.isNewDevice(userId, deviceInfo);
        if (isNewDevice && prefs?.newDeviceNotifications) {
            await this.notificationService.sendNotification({
                userId,
                type: 'new_device',
                title: 'New Device Login',
                message: `New login detected from ${deviceInfo.name} (${deviceInfo.os})`,
                data: {
                    sessionId: session._id,
                    deviceInfo,
                },
                channels: [NotificationChannel.EMAIL, NotificationChannel.IN_APP],
            });
        }
        // Log the action
        await this.auditService.log({
            userId: session.userId,
            action: SecurityAction.LOGIN,
            status: 'success',
            deviceInfo,
            metadata: {
                sessionId: session._id,
                isNewDevice,
            },
        });
        return session;
    }
    /**
     * Get active session by token
     */
    async getSessionByToken(token) {
        const db = await connectToDatabase();
        const session = await db.collection('user_sessions').findOne({
            token,
            status: 'active',
            expiresAt: { $gt: new Date() },
        });
        if (session) {
            // Update last active timestamp
            await db.collection('user_sessions').updateOne({ _id: session._id }, {
                $set: {
                    lastActive: new Date(),
                    updatedAt: new Date(),
                },
            });
        }
        return session;
    }
    /**
     * Get user's active sessions
     */
    async getActiveSessions(userId) {
        const db = await connectToDatabase();
        return db
            .collection('user_sessions')
            .find({
            userId,
            status: 'active',
            expiresAt: { $gt: new Date() },
        })
            .sort({ lastActive: -1 })
            .toArray();
    }
    /**
     * Revoke a session
     */
    async revokeSession(sessionId, userId, deviceInfo) {
        const db = await connectToDatabase();
        const result = await db.collection('user_sessions').updateOne({
            _id: sessionId,
            userId,
            status: 'active',
        }, {
            $set: {
                status: 'revoked',
                updatedAt: new Date(),
            },
        });
        if (result.modifiedCount > 0) {
            // Log the action
            await this.auditService.log({
                userId,
                action: SecurityAction.SESSION_REVOKE,
                status: 'success',
                deviceInfo,
            });
        }
    }
    /**
     * Revoke all sessions except current
     */
    async revokeOtherSessions(userId, currentSessionId, deviceInfo) {
        const db = await connectToDatabase();
        const result = await db.collection('user_sessions').updateMany({
            userId,
            _id: { $ne: currentSessionId },
            status: 'active',
        }, {
            $set: {
                status: 'revoked',
                updatedAt: new Date(),
            },
        });
        if (result.modifiedCount > 0) {
            // Log the action
            await this.auditService.log({
                userId,
                action: SecurityAction.SESSION_REVOKE,
                status: 'success',
                deviceInfo,
                metadata: {
                    revokedCount: result.modifiedCount,
                    type: 'other_sessions',
                },
            });
        }
    }
    /**
     * Check if device is new for user
     */
    async isNewDevice(userId, deviceInfo) {
        const db = await connectToDatabase();
        const existingSessions = await db
            .collection('user_sessions')
            .find({
            userId,
            'deviceInfo.name': deviceInfo.name,
            'deviceInfo.os': deviceInfo.os,
            'deviceInfo.browser': deviceInfo.browser,
        })
            .toArray();
        return existingSessions.length === 0;
    }
    /**
     * Clean up expired sessions
     */
    async cleanupExpiredSessions() {
        const db = await connectToDatabase();
        await db.collection('user_sessions').updateMany({
            status: 'active',
            expiresAt: { $lte: new Date() },
        }, {
            $set: {
                status: 'expired',
                updatedAt: new Date(),
            },
        });
    }
    /**
     * Authorize device
     */
    async authorizeDevice(userId, deviceInfo, trusted = false) {
        const db = await connectToDatabase();
        const now = new Date();
        const auth = {
            _id: new ObjectId(),
            userId,
            deviceId: generateToken(16),
            name: deviceInfo.name,
            type: deviceInfo.type,
            trusted,
            lastUsed: now,
            metadata: {
                os: deviceInfo.os,
                browser: deviceInfo.browser,
                ip: deviceInfo.ip,
                location: await getLocationFromIP(deviceInfo.ip),
            },
            createdAt: now,
            updatedAt: now,
        };
        await db.collection('device_authorizations').insertOne(auth);
        // Log the action
        await this.auditService.log({
            userId,
            action: SecurityAction.DEVICE_AUTHORIZE,
            status: 'success',
            deviceInfo,
            metadata: {
                deviceId: auth.deviceId,
                trusted,
            },
        });
        return auth;
    }
    /**
     * Revoke device authorization
     */
    async revokeDevice(userId, deviceId, deviceInfo) {
        const db = await connectToDatabase();
        const result = await db.collection('device_authorizations').deleteOne({
            userId,
            deviceId,
        });
        if (result.deletedCount > 0) {
            // Revoke all sessions from this device
            await db.collection('user_sessions').updateMany({
                userId,
                'deviceInfo.name': deviceInfo.name,
                'deviceInfo.os': deviceInfo.os,
                'deviceInfo.browser': deviceInfo.browser,
                status: 'active',
            }, {
                $set: {
                    status: 'revoked',
                    updatedAt: new Date(),
                },
            });
            // Log the action
            await this.auditService.log({
                userId,
                action: SecurityAction.DEVICE_REVOKE,
                status: 'success',
                deviceInfo,
                metadata: { deviceId },
            });
        }
    }
    /**
     * Get user's authorized devices
     */
    async getAuthorizedDevices(userId) {
        const db = await connectToDatabase();
        return db
            .collection('device_authorizations')
            .find({ userId })
            .sort({ lastUsed: -1 })
            .toArray();
    }
}
//# sourceMappingURL=session.service.js.map
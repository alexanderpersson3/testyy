import { ObjectId } from 'mongodb';
;
import { connectToDatabase } from '../db.js';
import logger from '../utils/logger.js';
import { NotificationManagerService } from '../notification-manager.service.js';
import { SecurityAuditLog, SecurityAction, DeviceType, SuspiciousActivity, } from '../types/security.js';
import { NotificationChannel } from '../types.js';
export class SecurityAuditService {
    constructor() {
        this.notificationService = NotificationManagerService.getInstance();
    }
    static getInstance() {
        if (!SecurityAuditService.instance) {
            SecurityAuditService.instance = new SecurityAuditService();
        }
        return SecurityAuditService.instance;
    }
    /**
     * Log a security event
     */
    async log(event) {
        const db = await connectToDatabase();
        const log = {
            _id: new ObjectId(),
            ...event,
            createdAt: new Date(),
        };
        await db.collection('security_audit_logs').insertOne(log);
        // Check for suspicious activity
        if (event.status === 'failure') {
            await this.checkForSuspiciousActivity(event);
        }
    }
    /**
     * Get audit logs for a user
     */
    async getAuditLogs(userId, options = {}) {
        const db = await connectToDatabase();
        const query = { userId };
        if (options.startDate || options.endDate) {
            query.createdAt = {};
            if (options.startDate) {
                query.createdAt.$gte = options.startDate;
            }
            if (options.endDate) {
                query.createdAt.$lte = options.endDate;
            }
        }
        if (options.actions?.length) {
            query.action = { $in: options.actions };
        }
        if (options.status?.length) {
            query.status = { $in: options.status };
        }
        return db
            .collection('security_audit_logs')
            .find(query)
            .sort({ createdAt: -1 })
            .skip(options.offset || 0)
            .limit(options.limit || 50)
            .toArray();
    }
    /**
     * Check for suspicious activity
     */
    async checkForSuspiciousActivity(event) {
        const db = await connectToDatabase();
        // Get recent failures for this action
        const recentFailures = await db
            .collection('security_audit_logs')
            .find({
            userId: event.userId,
            action: event.action,
            status: 'failure',
            createdAt: {
                $gte: new Date(Date.now() - 30 * 60 * 1000), // Last 30 minutes
            },
        })
            .toArray();
        // Check failure thresholds
        const shouldFlag = this.shouldFlagActivity(event.action, recentFailures.length);
        if (!shouldFlag) {
            return;
        }
        // Create suspicious activity entry
        const activity = {
            _id: new ObjectId(),
            userId: event.userId,
            type: this.mapActionToActivityType(event.action),
            severity: this.calculateSeverity(event.action, recentFailures.length),
            deviceInfo: event.deviceInfo,
            status: 'pending',
            metadata: {
                recentFailures: recentFailures.length,
                ...event.metadata,
            },
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        await db.collection('suspicious_activities').insertOne(activity);
        // Notify user
        await this.notificationService.sendNotification({
            userId: event.userId,
            type: 'security_alert',
            title: 'Suspicious Activity Detected',
            message: this.getAlertMessage(activity),
            data: {
                activityId: activity._id,
                type: activity.type,
                severity: activity.severity,
            },
            channels: [NotificationChannel.EMAIL, NotificationChannel.IN_APP],
        });
    }
    /**
     * Map security action to activity type
     */
    mapActionToActivityType(action) {
        switch (action) {
            case 'login':
                return 'login';
            case 'password_change':
                return 'password_reset';
            case 'email_change':
                return 'email_change';
            default:
                return 'unusual_activity';
        }
    }
    /**
     * Calculate severity based on action and failure count
     */
    calculateSeverity(action, failureCount) {
        const thresholds = {
            login: {
                medium: 3,
                high: 5,
            },
            password_change: {
                medium: 2,
                high: 4,
            },
            email_change: {
                medium: 2,
                high: 3,
            },
            default: {
                medium: 3,
                high: 5,
            },
        };
        const actionThresholds = thresholds[action] || thresholds.default;
        if (failureCount >= actionThresholds.high) {
            return 'high';
        }
        if (failureCount >= actionThresholds.medium) {
            return 'medium';
        }
        return 'low';
    }
    /**
     * Determine if activity should be flagged
     */
    shouldFlagActivity(action, failureCount) {
        const minimumFailures = {
            login: 3,
            password_change: 2,
            email_change: 2,
            two_factor_enable: 3,
            two_factor_disable: 2,
            recovery_codes_generate: 2,
            default: 3,
        };
        const threshold = minimumFailures[action] || minimumFailures.default;
        return failureCount >= threshold;
    }
    /**
     * Get alert message for suspicious activity
     */
    getAlertMessage(activity) {
        const severityText = {
            low: 'potentially suspicious',
            medium: 'suspicious',
            high: 'highly suspicious',
        };
        const actionText = {
            login: 'login attempts',
            password_reset: 'password reset attempts',
            email_change: 'email change attempts',
            unusual_activity: 'activity',
        };
        return `We detected ${severityText[activity.severity]} ${actionText[activity.type]} on your account from ${activity.deviceInfo.name} (${activity.deviceInfo.ip}). Please review your recent activity and secure your account if needed.`;
    }
    /**
     * Get suspicious activities
     */
    async getSuspiciousActivities(userId, options = {}) {
        const db = await connectToDatabase();
        const query = { userId };
        if (options.status?.length) {
            query.status = { $in: options.status };
        }
        if (options.type?.length) {
            query.type = { $in: options.type };
        }
        if (options.severity?.length) {
            query.severity = { $in: options.severity };
        }
        if (options.startDate || options.endDate) {
            query.createdAt = {};
            if (options.startDate) {
                query.createdAt.$gte = options.startDate;
            }
            if (options.endDate) {
                query.createdAt.$lte = options.endDate;
            }
        }
        return db
            .collection('suspicious_activities')
            .find(query)
            .sort({ createdAt: -1 })
            .skip(options.offset || 0)
            .limit(options.limit || 20)
            .toArray();
    }
    /**
     * Update suspicious activity status
     */
    async updateActivityStatus(activityId, status, resolution) {
        const db = await connectToDatabase();
        const update = {
            status,
            updatedAt: new Date(),
        };
        if (resolution) {
            update.resolution = resolution;
        }
        await db
            .collection('suspicious_activities')
            .updateOne({ _id: activityId }, { $set: update });
    }
}
//# sourceMappingURL=security-audit.service.js.map
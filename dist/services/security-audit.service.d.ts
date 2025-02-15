import { ObjectId } from 'mongodb';
import { SecurityAuditLog, SecurityAction, DeviceType, SuspiciousActivity } from '../types/security.js';
export declare class SecurityAuditService {
    private static instance;
    private notificationService;
    private constructor();
    static getInstance(): SecurityAuditService;
    /**
     * Log a security event
     */
    log(event: {
        userId: ObjectId;
        action: SecurityAction;
        status: 'success' | 'failure';
        deviceInfo: {
            type: DeviceType;
            name: string;
            os: string;
            browser: string;
            ip: string;
            userAgent: string;
        };
        metadata?: Record<string, any>;
    }): Promise<void>;
    /**
     * Get audit logs for a user
     */
    getAuditLogs(userId: ObjectId, options?: {
        startDate?: Date;
        endDate?: Date;
        actions?: SecurityAction[];
        status?: ('success' | 'failure')[];
        limit?: number;
        offset?: number;
    }): Promise<SecurityAuditLog[]>;
    /**
     * Check for suspicious activity
     */
    private checkForSuspiciousActivity;
    /**
     * Map security action to activity type
     */
    private mapActionToActivityType;
    /**
     * Calculate severity based on action and failure count
     */
    private calculateSeverity;
    /**
     * Determine if activity should be flagged
     */
    private shouldFlagActivity;
    /**
     * Get alert message for suspicious activity
     */
    private getAlertMessage;
    /**
     * Get suspicious activities
     */
    getSuspiciousActivities(userId: ObjectId, options?: {
        status?: SuspiciousActivity['status'][];
        type?: SuspiciousActivity['type'][];
        severity?: SuspiciousActivity['severity'][];
        startDate?: Date;
        endDate?: Date;
        limit?: number;
        offset?: number;
    }): Promise<SuspiciousActivity[]>;
    /**
     * Update suspicious activity status
     */
    updateActivityStatus(activityId: ObjectId, status: SuspiciousActivity['status'], resolution?: SuspiciousActivity['resolution']): Promise<void>;
}

const { getDb } = require('../db');
const { ObjectId } = require('mongodb');

class AuditLogger {
  constructor() {
    this.eventTypes = {
      USER: {
        LOGIN: 'user.login',
        LOGOUT: 'user.logout',
        REGISTER: 'user.register',
        UPDATE: 'user.update',
        DELETE: 'user.delete',
        ROLE_CHANGE: 'user.role_change',
        SUBSCRIPTION_START: 'user.subscription.start',
        SUBSCRIPTION_CANCEL: 'user.subscription.cancel',
        SUBSCRIPTION_EXPIRE: 'user.subscription.expire',
        SUBSCRIPTION_RENEW: 'user.subscription.renew',
        TRIAL_START: 'user.subscription.trial.start',
        TRIAL_END: 'user.subscription.trial.end',
        FOLLOW: 'user.follow',
        UNFOLLOW: 'user.unfollow',
        PREFERENCES_UPDATE: 'user.preferences.update',
        PROFILE_UPDATE: 'user.profile.update',
        SEARCH: 'user.search',
        PASSWORD_RESET_REQUEST: 'user.password.reset.request',
        PASSWORD_RESET_COMPLETE: 'user.password.reset.complete',
        PASSWORD_CHANGE: 'user.password.change',
        EMAIL_VERIFICATION_REQUEST: 'user.email.verification.request',
        EMAIL_VERIFIED: 'user.email.verified',
        ACCOUNT_DEACTIVATE: 'user.account.deactivate',
        ACCOUNT_REACTIVATE: 'user.account.reactivate',
        DATA_EXPORT: 'user.data.export',
        SESSION_INVALIDATE: 'user.session.invalidate',
        SESSION_INVALIDATE_ALL: 'user.session.invalidate.all',
        BLOCK: 'user.block',
        UNBLOCK: 'user.unblock',
        MUTE: 'user.mute',
        UNMUTE: 'user.unmute',
        REPORT: 'user.report',
        REPORT_REVIEW: 'user.report.review',
        REPORT_DISMISS: 'user.report.dismiss',
        DEVICE_ACCESS: 'user.device.access',
        DEVICE_REVOKE: 'user.device.revoke',
        DEVICE_REVOKE_ALL: 'user.device.revoke.all',
        DEVICE_SUSPICIOUS: 'user.device.suspicious',
        LOCALIZATION_SETTINGS_CREATE: 'user.localization.settings.create',
        LOCALIZATION_SETTINGS_UPDATE: 'user.localization.settings.update',
        LOCALIZATION_FORMAT_ERROR: 'user.localization.format.error',
        CONSENT_RECORD: 'user.consent.record',
        CONSENT_WITHDRAW: 'user.consent.withdraw',
        DATA_REQUEST_CREATE: 'user.data.request.create',
        DATA_REQUEST_UPDATE: 'user.data.request.update',
        DATA_REQUEST_COMPLETE: 'user.data.request.complete',
        DATA_REQUEST_REJECT: 'user.data.request.reject',
        PRIVACY_POLICY_ACCEPT: 'user.privacy.accept',
        TERMS_ACCEPT: 'user.terms.accept',
        ONBOARDING_INITIALIZE: 'user.onboarding.initialize',
        ONBOARDING_STEP_UPDATE: 'user.onboarding.step.update',
        ONBOARDING_COMPLETE: 'user.onboarding.complete',
        ONBOARDING_RESET: 'user.onboarding.reset'
      },
      RECIPE: {
        CREATE: 'recipe.create',
        UPDATE: 'recipe.update',
        DELETE: 'recipe.delete',
        PUBLISH: 'recipe.publish',
        FEATURE: 'recipe.feature',
        REVIEW_CREATE: 'recipe.review.create',
        REVIEW_UPDATE: 'recipe.review.update',
        REVIEW_DELETE: 'recipe.review.delete',
        REVIEW_REPORT: 'recipe.review.report',
        REVIEW_MODERATE: 'recipe.review.moderate',
        REVIEW_RESPONSE: 'recipe.review.response',
        REVIEW_RESPONSE_UPDATE: 'recipe.review.response.update'
      },
      INGREDIENT: {
        CREATE: 'ingredient.create',
        UPDATE: 'ingredient.update',
        DELETE: 'ingredient.delete',
        PRICE_UPDATE: 'ingredient.price_update',
        MODERATE: 'ingredient.moderate'
      },
      SECURITY: {
        AUTH_FAILURE: 'security.auth_failure',
        TOKEN_REFRESH: 'security.token_refresh',
        PERMISSION_DENIED: 'security.permission_denied',
        SUSPICIOUS_ACTIVITY: 'security.suspicious_activity',
        HIGH_RISK_OPERATION: 'security.high_risk_operation',
        ROLE_CHANGE: 'security.role_change',
        LOGIN_SUCCESS: 'security.login.success',
        LOGIN_FAILURE: 'security.login.failure',
        LOGOUT: 'security.logout',
        PASSWORD_CHANGE: 'security.password.change',
        PASSWORD_RESET: 'security.password.reset',
        TWO_FACTOR_SETUP: 'security.2fa.setup',
        TWO_FACTOR_ENABLE: 'security.2fa.enable',
        TWO_FACTOR_DISABLE: 'security.2fa.disable',
        TWO_FACTOR_VERIFY: 'security.2fa.verify',
        BACKUP_CODE_USE: 'security.2fa.backup_code.use'
      },
      ADMIN: {
        SETTINGS_CHANGE: 'admin.settings_change',
        USER_MODERATE: 'admin.user_moderate',
        SYSTEM_UPDATE: 'admin.system_update',
        BACKUP: 'admin.backup'
      },
      MEDIA: {
        UPLOAD: 'media.upload',
        DELETE: 'media.delete',
        THUMBNAIL_GENERATE: 'media.thumbnail.generate',
        VIDEO_PROCESS: 'media.video.process',
        CDN_SYNC: 'media.cdn.sync',
        STORAGE_CLEANUP: 'media.storage.cleanup'
      },
      INTEGRATION: {
        REGISTER: 'integration.register',
        UPDATE: 'integration.update',
        DELETE: 'integration.delete',
        TEST: 'integration.test',
        ERROR: 'integration.error'
      },
      FEED: {
        ACTIVITY_CREATE: 'feed.activity.create',
        ACTIVITY_DELETE: 'feed.activity.delete',
        FEED_GENERATE: 'feed.generate',
        FEED_REFRESH: 'feed.refresh',
        RECOMMENDATION_GENERATE: 'feed.recommendation.generate'
      },
      MEAL_PLAN: {
        CREATE: 'meal_plan.create',
        UPDATE: 'meal_plan.update',
        DELETE: 'meal_plan.delete',
        SHOPPING_LIST_GENERATE: 'meal_plan.shopping_list.generate'
      },
      PAYMENT: {
        METHOD_ADD: 'payment.method.add',
        METHOD_REMOVE: 'payment.method.remove',
        METHOD_DEFAULT_UPDATE: 'payment.method.default.update',
        REFUND_REQUEST: 'payment.refund.request',
        REFUND_PROCESS: 'payment.refund.process',
        REFUND_APPROVE: 'payment.refund.approve',
        REFUND_REJECT: 'payment.refund.reject',
        PAYMENT_PROCESS: 'payment.process',
        PAYMENT_FAIL: 'payment.fail',
        PAYMENT_SUCCESS: 'payment.success'
      },
      ANALYTICS: {
        LIFECYCLE_EVENT: 'analytics.lifecycle.event',
        ENGAGEMENT_METRICS_VIEW: 'analytics.engagement.view',
        FEATURE_ADOPTION_VIEW: 'analytics.feature_adoption.view',
        RETENTION_METRICS_VIEW: 'analytics.retention.view',
        EXPORT_METRICS: 'analytics.metrics.export'
      }
    };

    this.severityLevels = {
      INFO: 'info',
      WARNING: 'warning',
      ERROR: 'error',
      CRITICAL: 'critical'
    };
  }

  async log(eventType, data, options = {}) {
    try {
      const db = getDb();
      const now = new Date();

      const auditEntry = {
        eventType,
        timestamp: now,
        data,
        severity: options.severity || this.severityLevels.INFO,
        userId: options.userId ? new ObjectId(options.userId) : null,
        ipAddress: options.ipAddress || null,
        userAgent: options.userAgent || null,
        status: options.status || 'success',
        metadata: {
          ...options.metadata,
          environment: process.env.NODE_ENV
        },
        createdAt: now
      };

      await db.collection('auditLogs').insertOne(auditEntry);

      // If it's a critical event, also log to console
      if (options.severity === this.severityLevels.CRITICAL) {
        console.error('CRITICAL AUDIT EVENT:', {
          eventType,
          data,
          timestamp: now,
          userId: options.userId
        });
      }

      return auditEntry;
    } catch (err) {
      console.error('Error logging audit event:', err);
      // Still throw the error to ensure calling code knows about the failure
      throw err;
    }
  }

  async query(filters = {}, options = {}) {
    try {
      const db = getDb();
      const query = {};

      // Apply filters
      if (filters.eventType) {
        query.eventType = filters.eventType;
      }
      if (filters.severity) {
        query.severity = filters.severity;
      }
      if (filters.userId) {
        query.userId = new ObjectId(filters.userId);
      }
      if (filters.status) {
        query.status = filters.status;
      }
      if (filters.startDate || filters.endDate) {
        query.timestamp = {};
        if (filters.startDate) {
          query.timestamp.$gte = new Date(filters.startDate);
        }
        if (filters.endDate) {
          query.timestamp.$lte = new Date(filters.endDate);
        }
      }

      // Execute query with pagination
      const page = options.page || 1;
      const limit = options.limit || 50;
      const skip = (page - 1) * limit;

      const [logs, total] = await Promise.all([
        db.collection('auditLogs')
          .find(query)
          .sort({ timestamp: -1 })
          .skip(skip)
          .limit(limit)
          .toArray(),
        db.collection('auditLogs').countDocuments(query)
      ]);

      return {
        logs,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      };
    } catch (err) {
      console.error('Error querying audit logs:', err);
      throw err;
    }
  }

  async getEventStats(startDate, endDate) {
    try {
      const db = getDb();
      const query = {
        timestamp: {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        }
      };

      const stats = await db.collection('auditLogs').aggregate([
        { $match: query },
        {
          $group: {
            _id: {
              eventType: '$eventType',
              severity: '$severity',
              status: '$status'
            },
            count: { $sum: 1 }
          }
        },
        {
          $group: {
            _id: '$_id.eventType',
            severities: {
              $push: {
                severity: '$_id.severity',
                status: '$_id.status',
                count: '$count'
              }
            },
            totalCount: { $sum: '$count' }
          }
        },
        { $sort: { totalCount: -1 } }
      ]).toArray();

      return stats;
    } catch (err) {
      console.error('Error getting audit event stats:', err);
      throw err;
    }
  }

  async cleanup(retentionDays = 90) {
    try {
      const db = getDb();
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      // Don't delete critical events
      const result = await db.collection('auditLogs').deleteMany({
        timestamp: { $lt: cutoffDate },
        severity: { $ne: this.severityLevels.CRITICAL }
      });

      return {
        deletedCount: result.deletedCount,
        cutoffDate
      };
    } catch (err) {
      console.error('Error cleaning up audit logs:', err);
      throw err;
    }
  }

  // Helper method to determine if an event is high-risk
  isHighRiskEvent(eventType, data = {}) {
    const highRiskEvents = [
      this.eventTypes.USER.ROLE_CHANGE,
      this.eventTypes.SECURITY.AUTH_FAILURE,
      this.eventTypes.SECURITY.SUSPICIOUS_ACTIVITY,
      this.eventTypes.ADMIN.SETTINGS_CHANGE,
      this.eventTypes.ADMIN.USER_MODERATE
    ];

    return highRiskEvents.includes(eventType);
  }
}

module.exports = new AuditLogger(); 
const { getDb } = require('../db');
const { ObjectId } = require('mongodb');
const auditLogger = require('./audit-logger');

class UserAnalytics {
  constructor() {
    this.LIFECYCLE_EVENTS = {
      SIGNUP: 'signup',
      ONBOARDING_COMPLETE: 'onboarding_complete',
      FIRST_RECIPE_VIEW: 'first_recipe_view',
      FIRST_RECIPE_SAVE: 'first_recipe_save',
      FIRST_REVIEW: 'first_review',
      FIRST_FOLLOW: 'first_follow',
      SUBSCRIPTION_START: 'subscription_start',
      CHURN: 'churn',
      REACTIVATION: 'reactivation',
    };

    this.ENGAGEMENT_METRICS = {
      DAILY_ACTIVE: 'daily_active',
      WEEKLY_ACTIVE: 'weekly_active',
      MONTHLY_ACTIVE: 'monthly_active',
      RETENTION: 'retention',
      CHURN_RATE: 'churn_rate',
      FEATURE_ADOPTION: 'feature_adoption',
    };
  }

  async trackLifecycleEvent(userId, eventType, metadata = {}) {
    try {
      const db = getDb();

      if (!Object.values(this.LIFECYCLE_EVENTS).includes(eventType)) {
        throw new Error('Invalid lifecycle event type');
      }

      const event = {
        userId: new ObjectId(userId),
        eventType,
        metadata,
        timestamp: new Date(),
      };

      await db.collection('user_lifecycle_events').insertOne(event);

      await auditLogger.log(
        'analytics.lifecycle.event',
        { userId, eventType, metadata },
        { severity: auditLogger.severityLevels.INFO }
      );

      return event;
    } catch (err) {
      console.error('Error tracking lifecycle event:', err);
      throw err;
    }
  }

  async getEngagementMetrics(timeframe = '30d') {
    try {
      const db = getDb();
      const now = new Date();
      let startDate;

      switch (timeframe) {
        case '7d':
          startDate = new Date(now.setDate(now.getDate() - 7));
          break;
        case '30d':
          startDate = new Date(now.setDate(now.getDate() - 30));
          break;
        case '90d':
          startDate = new Date(now.setDate(now.getDate() - 90));
          break;
        default:
          throw new Error('Invalid timeframe');
      }

      const pipeline = [
        {
          $match: {
            timestamp: { $gte: startDate },
          },
        },
        {
          $group: {
            _id: {
              userId: '$userId',
              eventType: '$eventType',
            },
            count: { $sum: 1 },
            lastActivity: { $max: '$timestamp' },
          },
        },
        {
          $group: {
            _id: '$_id.eventType',
            uniqueUsers: { $sum: 1 },
            totalEvents: { $sum: '$count' },
            avgEventsPerUser: { $avg: '$count' },
          },
        },
      ];

      const metrics = await db.collection('user_lifecycle_events').aggregate(pipeline).toArray();

      return metrics;
    } catch (err) {
      console.error('Error getting engagement metrics:', err);
      throw err;
    }
  }

  async getFeatureAdoption(feature, timeframe = '30d') {
    try {
      const db = getDb();
      const now = new Date();
      const startDate = new Date(now.setDate(now.getDate() - parseInt(timeframe)));

      const totalUsers = await db.collection('users').countDocuments({
        createdAt: { $lte: now },
      });

      const usersWithFeature = await db.collection('user_lifecycle_events').distinct('userId', {
        eventType: feature,
        timestamp: { $gte: startDate },
      });

      const adoptionRate = (usersWithFeature.length / totalUsers) * 100;

      return {
        feature,
        totalUsers,
        activeUsers: usersWithFeature.length,
        adoptionRate: Math.round(adoptionRate * 100) / 100,
      };
    } catch (err) {
      console.error('Error getting feature adoption:', err);
      throw err;
    }
  }

  async getUserRetention(cohortPeriod = '30d') {
    try {
      const db = getDb();
      const now = new Date();
      const startDate = new Date(now.setDate(now.getDate() - parseInt(cohortPeriod)));

      const pipeline = [
        {
          $match: {
            eventType: this.LIFECYCLE_EVENTS.SIGNUP,
            timestamp: { $gte: startDate },
          },
        },
        {
          $lookup: {
            from: 'user_lifecycle_events',
            let: { userId: '$userId' },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ['$userId', '$$userId'] },
                      { $gt: ['$timestamp', '$$timestamp'] },
                    ],
                  },
                },
              },
            ],
            as: 'subsequent_events',
          },
        },
        {
          $project: {
            userId: 1,
            signupDate: '$timestamp',
            isRetained: {
              $cond: [{ $gt: [{ $size: '$subsequent_events' }, 0] }, true, false],
            },
          },
        },
        {
          $group: {
            _id: null,
            totalUsers: { $sum: 1 },
            retainedUsers: {
              $sum: { $cond: ['$isRetained', 1, 0] },
            },
          },
        },
      ];

      const [result] = await db.collection('user_lifecycle_events').aggregate(pipeline).toArray();

      return {
        period: cohortPeriod,
        totalUsers: result?.totalUsers || 0,
        retainedUsers: result?.retainedUsers || 0,
        retentionRate: result
          ? Math.round((result.retainedUsers / result.totalUsers) * 10000) / 100
          : 0,
      };
    } catch (err) {
      console.error('Error getting user retention:', err);
      throw err;
    }
  }
}

module.exports = new UserAnalytics();

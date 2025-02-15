const jobQueue = require('../job-queue');
const auditLogger = require('../audit-logger');
const { getDb } = require('../../db');
const { ObjectId } = require('mongodb');

class AnalyticsProcessor {
  constructor() {
    // Initialize processor
    jobQueue.processQueue('analytics', this.processJob.bind(this));

    // Analytics event types
    this.EVENT_TYPES = {
      PAGE_VIEW: 'page_view',
      USER_ACTION: 'user_action',
      API_CALL: 'api_call',
      ERROR: 'error',
      PERFORMANCE: 'performance',
    };
  }

  /**
   * Process analytics job
   */
  async processJob(job) {
    const { type, data } = job.data;

    try {
      switch (type) {
        case this.EVENT_TYPES.PAGE_VIEW:
          return await this.processPageView(data);
        case this.EVENT_TYPES.USER_ACTION:
          return await this.processUserAction(data);
        case this.EVENT_TYPES.API_CALL:
          return await this.processApiCall(data);
        case this.EVENT_TYPES.ERROR:
          return await this.processError(data);
        case this.EVENT_TYPES.PERFORMANCE:
          return await this.processPerformance(data);
        default:
          throw new Error(`Unknown analytics event type: ${type}`);
      }
    } catch (error) {
      console.error(`Error processing analytics job ${job.id}:`, error);
      throw error;
    }
  }

  /**
   * Process page view event
   */
  async processPageView(data) {
    try {
      const db = getDb();
      const event = {
        type: this.EVENT_TYPES.PAGE_VIEW,
        userId: data.userId ? new ObjectId(data.userId) : null,
        path: data.path,
        referrer: data.referrer,
        userAgent: data.userAgent,
        timestamp: new Date(),
        metadata: {
          sessionId: data.sessionId,
          deviceType: this.getDeviceType(data.userAgent),
          browser: this.getBrowser(data.userAgent),
        },
      };

      await db.collection('analytics_events').insertOne(event);

      // Update page view aggregates
      await this.updatePageViewAggregates(event);

      return event;
    } catch (error) {
      console.error('Error processing page view:', error);
      throw error;
    }
  }

  /**
   * Process user action event
   */
  async processUserAction(data) {
    try {
      const db = getDb();
      const event = {
        type: this.EVENT_TYPES.USER_ACTION,
        userId: data.userId ? new ObjectId(data.userId) : null,
        action: data.action,
        category: data.category,
        label: data.label,
        value: data.value,
        timestamp: new Date(),
        metadata: {
          sessionId: data.sessionId,
          path: data.path,
        },
      };

      await db.collection('analytics_events').insertOne(event);

      // Update user action aggregates
      await this.updateUserActionAggregates(event);

      return event;
    } catch (error) {
      console.error('Error processing user action:', error);
      throw error;
    }
  }

  /**
   * Process API call event
   */
  async processApiCall(data) {
    try {
      const db = getDb();
      const event = {
        type: this.EVENT_TYPES.API_CALL,
        userId: data.userId ? new ObjectId(data.userId) : null,
        endpoint: data.endpoint,
        method: data.method,
        statusCode: data.statusCode,
        responseTime: data.responseTime,
        timestamp: new Date(),
        metadata: {
          requestId: data.requestId,
          userAgent: data.userAgent,
          ipAddress: data.ipAddress,
        },
      };

      await db.collection('analytics_events').insertOne(event);

      // Update API metrics
      await this.updateApiMetrics(event);

      return event;
    } catch (error) {
      console.error('Error processing API call:', error);
      throw error;
    }
  }

  /**
   * Process error event
   */
  async processError(data) {
    try {
      const db = getDb();
      const event = {
        type: this.EVENT_TYPES.ERROR,
        userId: data.userId ? new ObjectId(data.userId) : null,
        errorType: data.errorType,
        message: data.message,
        stack: data.stack,
        timestamp: new Date(),
        metadata: {
          path: data.path,
          userAgent: data.userAgent,
          sessionId: data.sessionId,
        },
      };

      await db.collection('analytics_events').insertOne(event);

      // Update error aggregates
      await this.updateErrorAggregates(event);

      return event;
    } catch (error) {
      console.error('Error processing error event:', error);
      throw error;
    }
  }

  /**
   * Process performance event
   */
  async processPerformance(data) {
    try {
      const db = getDb();
      const event = {
        type: this.EVENT_TYPES.PERFORMANCE,
        userId: data.userId ? new ObjectId(data.userId) : null,
        metric: data.metric,
        value: data.value,
        timestamp: new Date(),
        metadata: {
          path: data.path,
          userAgent: data.userAgent,
          deviceType: this.getDeviceType(data.userAgent),
        },
      };

      await db.collection('analytics_events').insertOne(event);

      // Update performance metrics
      await this.updatePerformanceMetrics(event);

      return event;
    } catch (error) {
      console.error('Error processing performance event:', error);
      throw error;
    }
  }

  /**
   * Update page view aggregates
   */
  async updatePageViewAggregates(event) {
    try {
      const db = getDb();
      const date = new Date(event.timestamp);
      const hour = date.getHours();
      const dayOfWeek = date.getDay();

      await db.collection('page_view_stats').updateOne(
        {
          path: event.path,
          date: {
            year: date.getFullYear(),
            month: date.getMonth(),
            day: date.getDate(),
          },
        },
        {
          $inc: {
            total: 1,
            [`hourly.${hour}`]: 1,
            [`dayOfWeek.${dayOfWeek}`]: 1,
            [`devices.${event.metadata.deviceType}`]: 1,
            [`browsers.${event.metadata.browser}`]: 1,
          },
        },
        { upsert: true }
      );
    } catch (error) {
      console.error('Error updating page view aggregates:', error);
    }
  }

  /**
   * Update user action aggregates
   */
  async updateUserActionAggregates(event) {
    try {
      const db = getDb();
      const date = new Date(event.timestamp);

      await db.collection('user_action_stats').updateOne(
        {
          action: event.action,
          category: event.category,
          date: {
            year: date.getFullYear(),
            month: date.getMonth(),
            day: date.getDate(),
          },
        },
        {
          $inc: {
            total: 1,
            [`values.${event.value}`]: 1,
          },
          $addToSet: {
            users: event.userId,
          },
        },
        { upsert: true }
      );
    } catch (error) {
      console.error('Error updating user action aggregates:', error);
    }
  }

  /**
   * Update API metrics
   */
  async updateApiMetrics(event) {
    try {
      const db = getDb();
      const date = new Date(event.timestamp);

      await db.collection('api_metrics').updateOne(
        {
          endpoint: event.endpoint,
          method: event.method,
          date: {
            year: date.getFullYear(),
            month: date.getMonth(),
            day: date.getDate(),
            hour: date.getHours(),
          },
        },
        {
          $inc: {
            total: 1,
            [`status.${event.statusCode}`]: 1,
          },
          $push: {
            responseTimes: {
              $each: [event.responseTime],
              $slice: -100, // Keep last 100 response times
            },
          },
        },
        { upsert: true }
      );
    } catch (error) {
      console.error('Error updating API metrics:', error);
    }
  }

  /**
   * Update error aggregates
   */
  async updateErrorAggregates(event) {
    try {
      const db = getDb();
      const date = new Date(event.timestamp);

      await db.collection('error_stats').updateOne(
        {
          errorType: event.errorType,
          date: {
            year: date.getFullYear(),
            month: date.getMonth(),
            day: date.getDate(),
          },
        },
        {
          $inc: { total: 1 },
          $push: {
            occurrences: {
              timestamp: event.timestamp,
              userId: event.userId,
              message: event.message,
              path: event.metadata.path,
            },
          },
        },
        { upsert: true }
      );
    } catch (error) {
      console.error('Error updating error aggregates:', error);
    }
  }

  /**
   * Update performance metrics
   */
  async updatePerformanceMetrics(event) {
    try {
      const db = getDb();
      const date = new Date(event.timestamp);

      await db.collection('performance_metrics').updateOne(
        {
          metric: event.metric,
          date: {
            year: date.getFullYear(),
            month: date.getMonth(),
            day: date.getDate(),
            hour: date.getHours(),
          },
        },
        {
          $push: {
            values: {
              $each: [event.value],
              $slice: -100, // Keep last 100 values
            },
          },
        },
        { upsert: true }
      );
    } catch (error) {
      console.error('Error updating performance metrics:', error);
    }
  }

  /**
   * Get device type from user agent
   */
  getDeviceType(userAgent) {
    if (!userAgent) return 'unknown';
    if (/mobile/i.test(userAgent)) return 'mobile';
    if (/tablet/i.test(userAgent)) return 'tablet';
    return 'desktop';
  }

  /**
   * Get browser from user agent
   */
  getBrowser(userAgent) {
    if (!userAgent) return 'unknown';
    if (/chrome/i.test(userAgent)) return 'chrome';
    if (/firefox/i.test(userAgent)) return 'firefox';
    if (/safari/i.test(userAgent)) return 'safari';
    if (/edge/i.test(userAgent)) return 'edge';
    if (/opera/i.test(userAgent)) return 'opera';
    if (/msie|trident/i.test(userAgent)) return 'ie';
    return 'other';
  }
}

// Export singleton instance
module.exports = new AnalyticsProcessor();

const { getDb } = require('../db');
const { ObjectId } = require('mongodb');
const auditLogger = require('./audit-logger');

class AnalyticsManager {
  constructor() {
    this.eventTypes = {
      PAGE_VIEW: 'page_view',
      API_CALL: 'api_call',
      USER_ACTION: 'user_action',
      ERROR: 'error',
      PERFORMANCE: 'performance',
    };

    this.metricTypes = {
      COUNTER: 'counter',
      GAUGE: 'gauge',
      HISTOGRAM: 'histogram',
      SUMMARY: 'summary',
    };
  }

  async trackEvent(type, data, metadata = {}) {
    try {
      const db = getDb();
      const event = {
        type,
        data,
        metadata: {
          timestamp: new Date(),
          ...metadata,
        },
      };

      await db.collection('analytics_events').insertOne(event);

      // For high-volume events, we'll also maintain aggregated stats
      if (this.shouldAggregate(type)) {
        await this.updateAggregates(type, data, metadata);
      }

      return event;
    } catch (err) {
      console.error('Error tracking event:', err);
      throw err;
    }
  }

  async trackMetric(name, value, type = this.metricTypes.GAUGE, labels = {}) {
    try {
      const db = getDb();
      const metric = {
        name,
        value,
        type,
        labels,
        timestamp: new Date(),
      };

      await db.collection('metrics').insertOne(metric);

      // Update metric summaries for dashboards
      await this.updateMetricSummary(name, value, type, labels);

      return metric;
    } catch (err) {
      console.error('Error tracking metric:', err);
      throw err;
    }
  }

  async getFunnelAnalysis(funnelSteps, timeRange) {
    try {
      const db = getDb();
      const pipeline = [
        {
          $match: {
            type: 'user_action',
            'metadata.timestamp': {
              $gte: new Date(timeRange.start),
              $lte: new Date(timeRange.end),
            },
            'data.action': { $in: funnelSteps },
          },
        },
        {
          $group: {
            _id: '$data.action',
            count: { $sum: 1 },
            users: { $addToSet: '$metadata.userId' },
          },
        },
        {
          $project: {
            step: '$_id',
            count: 1,
            uniqueUsers: { $size: '$users' },
          },
        },
      ];

      const results = await db.collection('analytics_events').aggregate(pipeline).toArray();

      return this.calculateFunnelMetrics(results, funnelSteps);
    } catch (err) {
      console.error('Error analyzing funnel:', err);
      throw err;
    }
  }

  async getPerformanceMetrics(timeRange, filters = {}) {
    try {
      const db = getDb();
      const match = {
        type: this.eventTypes.PERFORMANCE,
        'metadata.timestamp': {
          $gte: new Date(timeRange.start),
          $lte: new Date(timeRange.end),
        },
      };

      if (filters.endpoint) {
        match['data.endpoint'] = filters.endpoint;
      }

      const pipeline = [
        { $match: match },
        {
          $group: {
            _id: {
              endpoint: '$data.endpoint',
              hour: {
                $dateToString: {
                  format: '%Y-%m-%d-%H',
                  date: '$metadata.timestamp',
                },
              },
            },
            avgResponseTime: { $avg: '$data.responseTime' },
            p95ResponseTime: {
              $percentile: {
                input: '$data.responseTime',
                p: 0.95,
              },
            },
            errorCount: {
              $sum: {
                $cond: [{ $eq: ['$data.status', 'error'] }, 1, 0],
              },
            },
            totalRequests: { $sum: 1 },
          },
        },
        {
          $project: {
            endpoint: '$_id.endpoint',
            hour: '$_id.hour',
            metrics: {
              avgResponseTime: '$avgResponseTime',
              p95ResponseTime: '$p95ResponseTime',
              errorRate: {
                $multiply: [{ $divide: ['$errorCount', '$totalRequests'] }, 100],
              },
              requestCount: '$totalRequests',
            },
          },
        },
        { $sort: { hour: 1 } },
      ];

      return await db.collection('analytics_events').aggregate(pipeline).toArray();
    } catch (err) {
      console.error('Error getting performance metrics:', err);
      throw err;
    }
  }

  async getCrashReport(timeRange) {
    try {
      const db = getDb();
      const pipeline = [
        {
          $match: {
            type: this.eventTypes.ERROR,
            'metadata.timestamp': {
              $gte: new Date(timeRange.start),
              $lte: new Date(timeRange.end),
            },
          },
        },
        {
          $group: {
            _id: {
              errorType: '$data.type',
              message: '$data.message',
            },
            count: { $sum: 1 },
            lastOccurred: { $max: '$metadata.timestamp' },
            affectedUsers: { $addToSet: '$metadata.userId' },
            examples: {
              $push: {
                $cond: [
                  { $lt: [{ $size: '$examples' }, 5] },
                  {
                    stack: '$data.stack',
                    metadata: '$metadata',
                  },
                  '$$REMOVE',
                ],
              },
            },
          },
        },
        {
          $project: {
            errorType: '$_id.errorType',
            message: '$_id.message',
            count: 1,
            lastOccurred: 1,
            uniqueUsers: { $size: '$affectedUsers' },
            examples: { $slice: ['$examples', 5] },
          },
        },
        { $sort: { count: -1 } },
      ];

      return await db.collection('analytics_events').aggregate(pipeline).toArray();
    } catch (err) {
      console.error('Error generating crash report:', err);
      throw err;
    }
  }

  async shouldAggregate(type) {
    // Determine if event type needs aggregation
    return ['page_view', 'api_call'].includes(type);
  }

  async updateAggregates(type, data, metadata) {
    const db = getDb();
    const hour = new Date(metadata.timestamp);
    hour.setMinutes(0, 0, 0);

    const key = {
      type,
      hour,
      ...this.getAggregateKey(type, data),
    };

    await db.collection('analytics_aggregates').updateOne(
      key,
      {
        $inc: { count: 1 },
        $set: { lastUpdated: new Date() },
      },
      { upsert: true }
    );
  }

  getAggregateKey(type, data) {
    switch (type) {
      case 'page_view':
        return { path: data.path };
      case 'api_call':
        return { endpoint: data.endpoint, method: data.method };
      default:
        return {};
    }
  }

  async updateMetricSummary(name, value, type, labels) {
    const db = getDb();
    const hour = new Date();
    hour.setMinutes(0, 0, 0);

    const summary = {
      name,
      type,
      labels,
      hour,
    };

    const update = {
      $inc: { count: 1, sum: value },
      $min: { min: value },
      $max: { max: value },
      $set: { lastUpdated: new Date() },
    };

    if (type === this.metricTypes.HISTOGRAM) {
      const bucket = this.getBucket(value);
      update.$inc[`buckets.${bucket}`] = 1;
    }

    await db.collection('metric_summaries').updateOne(summary, update, { upsert: true });
  }

  getBucket(value) {
    // Implement bucketing logic based on your needs
    const buckets = [0, 10, 100, 1000, 10000];
    return buckets.find(b => value <= b) || 'inf';
  }

  calculateFunnelMetrics(results, steps) {
    const stepData = new Map(results.map(r => [r.step, r]));
    const metrics = [];
    let previousCount = 0;

    for (const step of steps) {
      const data = stepData.get(step) || { count: 0, uniqueUsers: 0 };
      const conversionRate = previousCount ? (data.count / previousCount) * 100 : 100;

      metrics.push({
        step,
        count: data.count,
        uniqueUsers: data.uniqueUsers,
        conversionRate: Math.round(conversionRate * 100) / 100,
        dropoff: previousCount ? previousCount - data.count : 0,
      });

      previousCount = data.count;
    }

    return metrics;
  }
}

module.exports = new AnalyticsManager();

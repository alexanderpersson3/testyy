import { ObjectId } from 'mongodb';;;;
import { connectToDatabase } from '../db.js';;
import logger from '../utils/logger.js';
import { NotificationManagerService } from '../notification-manager.service.js';;

interface SearchPerformanceMetrics {
  _id?: ObjectId;
  timestamp: Date;
  averageResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  errorRate: number;
  totalQueries: number;
  uniqueUsers: number;
  cacheHitRate: number;
  slowQueries: Array<{
    query: string;
    responseTime: number;
    timestamp: Date;
  }>;
  errorQueries: Array<{
    query: string;
    error: string;
    timestamp: Date;
  }>;
}

interface QueryPerformance {
  _id?: ObjectId;
  query: string;
  filters?: Record<string, any>;
  responseTime: number;
  timestamp: Date;
  userId?: ObjectId;
  successful: boolean;
  error?: string;
  resultCount: number;
  cacheHit: boolean;
}

interface PerformanceAlert {
  type: 'slow_queries' | 'high_error_rate' | 'low_cache_hit_rate';
  metric: number;
  threshold: number;
  timestamp: Date;
}

export class SearchPerformanceService {
  private static instance: SearchPerformanceService;
  private notificationService: NotificationManagerService;

  // Performance thresholds
  private readonly SLOW_QUERY_THRESHOLD = 1000; // ms
  private readonly ERROR_RATE_THRESHOLD = 0.05; // 5%
  private readonly CACHE_HIT_RATE_THRESHOLD = 0.7; // 70%

  private constructor() {
    this.notificationService = NotificationManagerService.getInstance();
  }

  static getInstance(): SearchPerformanceService {
    if (!SearchPerformanceService.instance) {
      SearchPerformanceService.instance = new SearchPerformanceService();
    }
    return SearchPerformanceService.instance;
  }

  /**
   * Log query performance
   */
  async logQueryPerformance(performance: Omit<QueryPerformance, '_id'>): Promise<void> {
    const db = await connectToDatabase();

    await db.collection<QueryPerformance>('query_performance').insertOne({
      ...performance,
      timestamp: new Date(),
    });

    // Check for performance issues
    if (performance.responseTime > this.SLOW_QUERY_THRESHOLD) {
      await this.handleSlowQuery(performance);
    }

    // Update real-time metrics
    await this.updateRealTimeMetrics(performance);
  }

  /**
   * Get performance metrics for a time period
   */
  async getPerformanceMetrics(startDate: Date, endDate: Date): Promise<SearchPerformanceMetrics> {
    const db = await connectToDatabase();

    const pipeline = [
      {
        $match: {
          timestamp: {
            $gte: startDate,
            $lte: endDate,
          },
        },
      },
      {
        $group: {
          _id: null,
          totalQueries: { $sum: 1 },
          uniqueUsers: { $addToSet: '$userId' },
          totalResponseTime: { $sum: '$responseTime' },
          errorCount: {
            $sum: {
              $cond: [{ $eq: ['$successful', false] }, 1, 0],
            },
          },
          cacheHits: {
            $sum: {
              $cond: [{ $eq: ['$cacheHit', true] }, 1, 0],
            },
          },
          responseTimes: { $push: '$responseTime' },
        },
      },
    ];

    const [result] = await db
      .collection<QueryPerformance>('query_performance')
      .aggregate(pipeline)
      .toArray();

    // Get slow queries
    const slowQueries = await db
      .collection<QueryPerformance>('query_performance')
      .find({
        timestamp: { $gte: startDate, $lte: endDate },
        responseTime: { $gt: this.SLOW_QUERY_THRESHOLD },
      })
      .sort({ responseTime: -1 })
      .limit(10)
      .toArray();

    // Get error queries
    const errorQueries = await db
      .collection<QueryPerformance>('query_performance')
      .find({
        timestamp: { $gte: startDate, $lte: endDate },
        successful: false,
      })
      .sort({ timestamp: -1 })
      .limit(10)
      .toArray();

    // Calculate percentiles
    const sortedTimes = result.responseTimes.sort((a: number, b: number) => a - b);
    const p95Index = Math.floor(sortedTimes.length * 0.95);
    const p99Index = Math.floor(sortedTimes.length * 0.99);

    return {
      timestamp: new Date(),
      averageResponseTime: result.totalResponseTime / result.totalQueries,
      p95ResponseTime: sortedTimes[p95Index] || 0,
      p99ResponseTime: sortedTimes[p99Index] || 0,
      errorRate: result.errorCount / result.totalQueries,
      totalQueries: result.totalQueries,
      uniqueUsers: result.uniqueUsers.length,
      cacheHitRate: result.cacheHits / result.totalQueries,
      slowQueries: slowQueries.map(q => ({
        query: q.query,
        responseTime: q.responseTime,
        timestamp: q.timestamp,
      })),
      errorQueries: errorQueries.map(q => ({
        query: q.query,
        error: q.error || 'Unknown error',
        timestamp: q.timestamp,
      })),
    };
  }

  /**
   * Get real-time performance metrics
   */
  async getRealTimeMetrics(minutes: number = 5): Promise<SearchPerformanceMetrics> {
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - minutes * 60 * 1000);
    return this.getPerformanceMetrics(startDate, endDate);
  }

  /**
   * Handle slow query detection
   */
  private async handleSlowQuery(performance: QueryPerformance): Promise<void> {
    logger.warn('Slow query detected', {
      query: performance.query,
      responseTime: performance.responseTime,
      timestamp: performance.timestamp,
    });

    const alert: PerformanceAlert = {
      type: 'slow_queries',
      metric: performance.responseTime,
      threshold: this.SLOW_QUERY_THRESHOLD,
      timestamp: new Date(),
    };

    if (performance.userId) {
      await this.notificationService.sendNotification({
        type: 'performance_alert',
        userId: performance.userId,
        title: 'Search Performance Alert',
        message: `Slow query detected: ${performance.query} (${performance.responseTime}ms)`,
        data: alert,
      });
    }
  }

  /**
   * Update real-time metrics
   */
  private async updateRealTimeMetrics(performance: QueryPerformance): Promise<void> {
    const db = await connectToDatabase();

    const now = new Date();
    const timeWindow = new Date(now.getTime() - 5 * 60 * 1000); // 5 minutes

    // Update metrics for the current time window
    const updateQuery: any = {
      $inc: {
        totalQueries: 1,
        totalResponseTime: performance.responseTime,
      },
      $push: {
        responseTimes: performance.responseTime,
      },
    };

    if (performance.userId) {
      updateQuery.$addToSet = {
        uniqueUsers: performance.userId,
      };
    }

    await db.collection<SearchPerformanceMetrics>('search_performance_metrics').updateOne(
      {
        timestamp: {
          $gte: timeWindow,
          $lte: now,
        },
      },
      updateQuery,
      { upsert: true }
    );

    // Check for performance alerts
    const metrics = await this.getRealTimeMetrics();

    if (metrics.errorRate > this.ERROR_RATE_THRESHOLD && performance.userId) {
      const alert: PerformanceAlert = {
        type: 'high_error_rate',
        metric: metrics.errorRate,
        threshold: this.ERROR_RATE_THRESHOLD,
        timestamp: now,
      };

      await this.notificationService.sendNotification({
        type: 'performance_alert',
        userId: performance.userId,
        title: 'High Error Rate Alert',
        message: `Search error rate has exceeded threshold: ${(metrics.errorRate * 100).toFixed(1)}%`,
        data: alert,
      });
    }

    if (metrics.cacheHitRate < this.CACHE_HIT_RATE_THRESHOLD && performance.userId) {
      const alert: PerformanceAlert = {
        type: 'low_cache_hit_rate',
        metric: metrics.cacheHitRate,
        threshold: this.CACHE_HIT_RATE_THRESHOLD,
        timestamp: now,
      };

      await this.notificationService.sendNotification({
        type: 'performance_alert',
        userId: performance.userId,
        title: 'Low Cache Hit Rate Alert',
        message: `Search cache hit rate has fallen below threshold: ${(metrics.cacheHitRate * 100).toFixed(1)}%`,
        data: alert,
      });
    }
  }
}

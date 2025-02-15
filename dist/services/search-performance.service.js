import { ObjectId } from 'mongodb';
;
import { connectToDatabase } from '../db.js';
import logger from '../utils/logger.js';
import { NotificationManagerService } from '../notification-manager.service.js';
export class SearchPerformanceService {
    constructor() {
        // Performance thresholds
        this.SLOW_QUERY_THRESHOLD = 1000; // ms
        this.ERROR_RATE_THRESHOLD = 0.05; // 5%
        this.CACHE_HIT_RATE_THRESHOLD = 0.7; // 70%
        this.notificationService = NotificationManagerService.getInstance();
    }
    static getInstance() {
        if (!SearchPerformanceService.instance) {
            SearchPerformanceService.instance = new SearchPerformanceService();
        }
        return SearchPerformanceService.instance;
    }
    /**
     * Log query performance
     */
    async logQueryPerformance(performance) {
        const db = await connectToDatabase();
        await db.collection('query_performance').insertOne({
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
    async getPerformanceMetrics(startDate, endDate) {
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
            .collection('query_performance')
            .aggregate(pipeline)
            .toArray();
        // Get slow queries
        const slowQueries = await db
            .collection('query_performance')
            .find({
            timestamp: { $gte: startDate, $lte: endDate },
            responseTime: { $gt: this.SLOW_QUERY_THRESHOLD },
        })
            .sort({ responseTime: -1 })
            .limit(10)
            .toArray();
        // Get error queries
        const errorQueries = await db
            .collection('query_performance')
            .find({
            timestamp: { $gte: startDate, $lte: endDate },
            successful: false,
        })
            .sort({ timestamp: -1 })
            .limit(10)
            .toArray();
        // Calculate percentiles
        const sortedTimes = result.responseTimes.sort((a, b) => a - b);
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
    async getRealTimeMetrics(minutes = 5) {
        const endDate = new Date();
        const startDate = new Date(endDate.getTime() - minutes * 60 * 1000);
        return this.getPerformanceMetrics(startDate, endDate);
    }
    /**
     * Handle slow query detection
     */
    async handleSlowQuery(performance) {
        logger.warn('Slow query detected', {
            query: performance.query,
            responseTime: performance.responseTime,
            timestamp: performance.timestamp,
        });
        const alert = {
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
    async updateRealTimeMetrics(performance) {
        const db = await connectToDatabase();
        const now = new Date();
        const timeWindow = new Date(now.getTime() - 5 * 60 * 1000); // 5 minutes
        // Update metrics for the current time window
        const updateQuery = {
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
        await db.collection('search_performance_metrics').updateOne({
            timestamp: {
                $gte: timeWindow,
                $lte: now,
            },
        }, updateQuery, { upsert: true });
        // Check for performance alerts
        const metrics = await this.getRealTimeMetrics();
        if (metrics.errorRate > this.ERROR_RATE_THRESHOLD && performance.userId) {
            const alert = {
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
            const alert = {
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
//# sourceMappingURL=search-performance.service.js.map
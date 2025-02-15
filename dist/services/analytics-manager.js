import { ObjectId } from 'mongodb';
;
import { connectToDatabase } from '../db.js';
import logger from '../utils/logger.js';
export class AnalyticsManager {
    constructor() { }
    static getInstance() {
        if (!AnalyticsManager.instance) {
            AnalyticsManager.instance = new AnalyticsManager();
        }
        return AnalyticsManager.instance;
    }
    async trackEvent(type, data, userId) {
        try {
            await connectToDatabase();
            const event = {
                type,
                userId,
                data,
                timestamp: new Date(),
            };
            await getCollection('analytics_events').insertOne(event);
            // Update aggregates in background
            this.updateEventAggregates(type, data).catch(error => {
                logger.error('Failed to update event aggregates:', error);
            });
        }
        catch (error) {
            logger.error('Failed to track event:', error);
            throw error;
        }
    }
    async trackMetric(name, value, tags = {}) {
        try {
            await connectToDatabase();
            const metric = {
                name,
                value,
                tags,
                timestamp: new Date(),
            };
            await getCollection('metrics').insertOne(metric);
            // Update aggregates in background
            this.updateMetricAggregates(name, value, tags).catch(error => {
                logger.error('Failed to update metric aggregates:', error);
            });
        }
        catch (error) {
            logger.error('Failed to track metric:', error);
            throw error;
        }
    }
    async updateEventAggregates(type, data) {
        try {
            await connectToDatabase();
            const now = new Date();
            const hour = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours());
            const day = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const week = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
            const month = new Date(now.getFullYear(), now.getMonth(), 1);
            const periods = [
                { name: 'hourly', timestamp: hour },
                { name: 'daily', timestamp: day },
                { name: 'weekly', timestamp: week },
                { name: 'monthly', timestamp: month },
            ];
            await Promise.all(periods.map(period => getCollection('analytics_aggregates').updateOne({
                name: `events.${type}`,
                period: period.name,
                timestamp: period.timestamp,
            }, {
                $inc: { count: 1 },
                $set: {
                    lastUpdated: now,
                    ...this.extractAggregateData(data),
                },
            }, { upsert: true })));
        }
        catch (error) {
            logger.error('Failed to update event aggregates:', error);
            throw error;
        }
    }
    async updateMetricAggregates(name, value, tags) {
        try {
            await connectToDatabase();
            const now = new Date();
            const hour = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours());
            const day = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const week = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
            const month = new Date(now.getFullYear(), now.getMonth(), 1);
            const periods = [
                { name: 'hourly', timestamp: hour },
                { name: 'daily', timestamp: day },
                { name: 'weekly', timestamp: week },
                { name: 'monthly', timestamp: month },
            ];
            await Promise.all(periods.map(period => getCollection('metric_summaries').updateOne({
                name,
                period: period.name,
                timestamp: period.timestamp,
                tags,
            }, {
                $inc: {
                    count: 1,
                    value: value,
                },
                $min: { min: value },
                $max: { max: value },
                $set: { lastUpdated: now },
            }, { upsert: true })));
        }
        catch (error) {
            logger.error('Failed to update metric aggregates:', error);
            throw error;
        }
    }
    extractAggregateData(data) {
        // Extract relevant fields from event data for aggregation
        const aggregateData = {};
        // Add any numeric values for aggregation
        Object.entries(data).forEach(([key, value]) => {
            if (typeof value === 'number') {
                aggregateData[`sums.${key}`] = value;
            }
        });
        return aggregateData;
    }
}
//# sourceMappingURL=analytics-manager.js.map
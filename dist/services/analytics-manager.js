import { getDb } from '../config/db.js';
class AnalyticsManager {
    constructor() {
        this.eventTypes = {
            PAGE_VIEW: 'page_view',
            API_CALL: 'api_call',
            USER_ACTION: 'user_action',
            ERROR: 'error',
            PERFORMANCE: 'performance'
        };
        this.metricTypes = {
            COUNTER: 'counter',
            GAUGE: 'gauge',
            HISTOGRAM: 'histogram',
            SUMMARY: 'summary'
        };
    }
    async trackEvent(type, data, metadata = {}) {
        try {
            const db = await getDb();
            const event = {
                type,
                data,
                metadata: {
                    timestamp: new Date(),
                    ...metadata
                }
            };
            await db.collection('analytics_events').insertOne(event);
            // For high-volume events, we'll also maintain aggregated stats
            if (await this.shouldAggregate(type)) {
                await this.updateAggregates(type, data, event.metadata);
            }
            return event;
        }
        catch (err) {
            console.error('Error tracking event:', err);
            throw err;
        }
    }
    async trackMetric(name, value, type = this.metricTypes.GAUGE, labels = {}) {
        try {
            const db = await getDb();
            const metric = {
                name,
                value,
                type,
                labels,
                timestamp: new Date()
            };
            await db.collection('metrics').insertOne(metric);
            // Update metric summaries for dashboards
            await this.updateMetricSummary(name, value, type, labels);
            return metric;
        }
        catch (err) {
            console.error('Error tracking metric:', err);
            throw err;
        }
    }
    async shouldAggregate(type) {
        // Determine if event type needs aggregation
        return ['page_view', 'api_call'].includes(type);
    }
    async updateAggregates(type, data, metadata) {
        const db = await getDb();
        const hour = new Date(metadata.timestamp);
        hour.setMinutes(0, 0, 0);
        const key = {
            type,
            hour,
            ...this.getAggregateKey(type, data)
        };
        await db.collection('analytics_aggregates').updateOne(key, {
            $inc: { count: 1 },
            $set: { lastUpdated: new Date() }
        }, { upsert: true });
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
        const db = await getDb();
        const hour = new Date();
        hour.setMinutes(0, 0, 0);
        const summary = {
            name,
            type,
            labels,
            hour
        };
        const update = {
            $inc: { count: 1, sum: value },
            $min: { min: value },
            $max: { max: value },
            $set: { lastUpdated: new Date() }
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
        return buckets.find(b => value <= b)?.toString() || 'inf';
    }
}
export default new AnalyticsManager();
//# sourceMappingURL=analytics-manager.js.map
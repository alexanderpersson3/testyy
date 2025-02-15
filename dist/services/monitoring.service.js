import * as Sentry from '@sentry/node';
import logger from '../utils/logger.js';
import { MetricData, EndpointMetric, SystemMetric, ErrorDistribution, SlowEndpoint, } from '../types/monitoring.js';
export class MonitoringService {
    constructor() {
        this.metrics = new Map();
        this.initializeSentry();
    }
    static getInstance() {
        if (!MonitoringService.instance) {
            MonitoringService.instance = new MonitoringService();
        }
        return MonitoringService.instance;
    }
    initializeSentry() {
        if (process.env.SENTRY_DSN) {
            const options = {
                dsn: process.env.SENTRY_DSN,
                tracesSampleRate: 1.0,
                environment: process.env.NODE_ENV || 'development',
            };
            Sentry.init(options);
        }
    }
    getRequestHandler() {
        return Sentry.Handlers.requestHandler();
    }
    getErrorHandler() {
        return Sentry.Handlers.errorHandler();
    }
    async close() {
        await Sentry.close();
    }
    captureException(error) {
        Sentry.captureException(error);
    }
    captureMessage(message) {
        Sentry.captureMessage(message);
    }
    async logPerformanceMetric(metric) {
        // Implementation needed
    }
    async logResourceMetric(metric) {
        // Implementation needed
    }
    trackHttpRequest(request, response, duration) {
        try {
            const path = request.path;
            const method = request.method;
            const statusCode = response.statusCode;
            // Track request count
            this.incrementMetric(`http_requests_total{path="${path}",method="${method}"}`);
            // Track response status codes
            this.incrementMetric(`http_response_status{status="${statusCode}"}`);
            // Track request duration
            this.recordDuration(`http_request_duration{path="${path}"}`, duration);
            // Log for monitoring
            logger.info('Request tracked:', {
                path,
                method,
                statusCode,
                duration,
            });
        }
        catch (error) {
            logger.error('Failed to track request:', error);
        }
    }
    trackDatabaseOperation(operation, collection, count) {
        const metric = {
            name: 'database_operation',
            value: count,
            labels: {
                operation,
                collection,
            },
        };
        this.recordMetric(metric);
    }
    async getEndpointMetrics(startDate, endDate) {
        // Implementation needed
        return [];
    }
    async getSystemMetrics(startDate, endDate) {
        // Implementation needed
        return [];
    }
    async getErrorDistribution(startDate, endDate) {
        // Implementation needed
        return [];
    }
    async getSlowEndpoints(startDate, endDate) {
        // Implementation needed
        return [];
    }
    recordError(name, error) {
        logger.error(`${name} error:`, error);
        this.captureException(error);
    }
    recordMetric(metric) {
        const { name, value, labels = {} } = metric;
        const labelString = Object.entries(labels)
            .map(([k, v]) => `${k}="${v}"`)
            .join(',');
        const key = labelString ? `${name}{${labelString}}` : name;
        this.metrics.set(key, value);
    }
    recordEvent(name, data) {
        // Implementation needed
    }
    incrementMetric(key) {
        const currentValue = this.metrics.get(key) || 0;
        this.metrics.set(key, currentValue + 1);
    }
    recordDuration(key, duration) {
        const currentTotal = this.metrics.get(`${key}_total`) || 0;
        const currentCount = this.metrics.get(`${key}_count`) || 0;
        this.metrics.set(`${key}_total`, currentTotal + duration);
        this.metrics.set(`${key}_count`, currentCount + 1);
    }
    getMetrics() {
        return Object.fromEntries(this.metrics);
    }
    resetMetrics() {
        this.metrics.clear();
    }
}
MonitoringService.instance = null;
export const monitoring = MonitoringService.getInstance();
//# sourceMappingURL=monitoring.service.js.map
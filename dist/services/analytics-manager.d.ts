export interface EventTypes {
    PAGE_VIEW: string;
    API_CALL: string;
    USER_ACTION: string;
    ERROR: string;
    PERFORMANCE: string;
}
export interface MetricTypes {
    COUNTER: string;
    GAUGE: string;
    HISTOGRAM: string;
    SUMMARY: string;
}
export interface EventMetadata {
    timestamp: Date;
    userId?: string;
    ipAddress?: string;
    userAgent?: string;
    [key: string]: any;
}
export interface Event {
    type: string;
    data: any;
    metadata: EventMetadata;
}
export interface Metric {
    name: string;
    value: number;
    type: string;
    labels: Record<string, string>;
    timestamp: Date;
}
declare class AnalyticsManager {
    readonly eventTypes: EventTypes;
    readonly metricTypes: MetricTypes;
    trackEvent(type: string, data: any, metadata?: Omit<EventMetadata, 'timestamp'>): Promise<Event>;
    trackMetric(name: string, value: number, type?: string, labels?: Record<string, string>): Promise<Metric>;
    private shouldAggregate;
    private updateAggregates;
    private getAggregateKey;
    private updateMetricSummary;
    private getBucket;
}
declare const _default: AnalyticsManager;
export default _default;
//# sourceMappingURL=analytics-manager.d.ts.map
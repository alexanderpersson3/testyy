import { ObjectId } from 'mongodb';
export declare class AnalyticsManager {
    private static instance;
    private constructor();
    static getInstance(): AnalyticsManager;
    trackEvent(type: string, data: Record<string, any>, userId?: ObjectId): Promise<void>;
    trackMetric(name: string, value: number, tags?: Record<string, string>): Promise<void>;
    private updateEventAggregates;
    private updateMetricAggregates;
    private extractAggregateData;
}

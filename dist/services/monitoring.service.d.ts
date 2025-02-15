import type { RequestHandler, ErrorRequestHandler } from '../types/index.js';
import type { MonitoringRequest, MonitoringResponse } from '../types/index.js';
import { MetricData, EndpointMetric, SystemMetric, ErrorDistribution, SlowEndpoint } from '../types/monitoring.js';
interface PerformanceMetric {
    path: string;
    method: string;
    duration: number;
    timestamp: Date;
}
interface ResourceMetric {
    name: string;
    value: number;
    unit: string;
    timestamp: Date;
}
export declare class MonitoringService {
    private static instance;
    private metrics;
    protected constructor();
    static getInstance(): MonitoringService;
    private initializeSentry;
    getRequestHandler(): RequestHandler;
    getErrorHandler(): ErrorRequestHandler;
    close(): Promise<void>;
    captureException(error: Error): void;
    captureMessage(message: string): void;
    logPerformanceMetric(metric: PerformanceMetric): Promise<void>;
    logResourceMetric(metric: ResourceMetric): Promise<void>;
    trackHttpRequest(request: MonitoringRequest, response: MonitoringResponse, duration: number): void;
    trackDatabaseOperation(operation: string, collection: string, count: number): void;
    getEndpointMetrics(startDate: Date, endDate: Date): Promise<EndpointMetric[]>;
    getSystemMetrics(startDate: Date, endDate: Date): Promise<SystemMetric[]>;
    getErrorDistribution(startDate: Date, endDate: Date): Promise<ErrorDistribution[]>;
    getSlowEndpoints(startDate: Date, endDate: Date): Promise<SlowEndpoint[]>;
    recordError(name: string, error: Error): void;
    recordMetric(metric: MetricData): void;
    recordEvent(name: string, data: Record<string, any>): void;
    private incrementMetric;
    private recordDuration;
    getMetrics(): Record<string, number>;
    resetMetrics(): void;
}
export declare const monitoring: MonitoringService;
export {};

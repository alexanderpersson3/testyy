export interface MonitoringRequest {
    path: string;
    method: string;
    headers: Record<string, string>;
    query: Record<string, string>;
}
export interface MonitoringResponse {
    statusCode: number;
    headers: Record<string, string>;
    body: Record<string, unknown>;
}
export interface MetricData {
    name: string;
    value: number;
    labels?: Record<string, string>;
    timestamp?: Date;
}
export interface EndpointMetric {
    path: string;
    method: string;
    count: number;
    avgDuration: number;
    p95Duration: number;
}
export interface SystemMetric {
    name: string;
    value: number;
    unit: string;
}
export interface ErrorDistribution {
    statusCode: number;
    count: number;
    percentage: number;
}
export interface SlowEndpoint {
    path: string;
    method: string;
    avgDuration: number;
    count: number;
}

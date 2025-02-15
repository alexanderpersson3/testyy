import * as Sentry from '@sentry/node';
import type { Options } from '../types/express.js';
import type { RequestHandler, ErrorRequestHandler } from '../types/express.js';
import logger from '../utils/logger.js';
import type { MonitoringRequest, MonitoringResponse } from '../types/express.js';
import { MetricData, EndpointMetric, SystemMetric, ErrorDistribution, SlowEndpoint,  } from '../types/monitoring.js';;
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

export class MonitoringService {
  private static instance: MonitoringService | null = null;
  private metrics: Map<string, number> = new Map();

  protected constructor() {
    this.initializeSentry();
  }

  public static getInstance(): MonitoringService {
    if (!MonitoringService.instance) {
      MonitoringService.instance = new MonitoringService();
    }
    return MonitoringService.instance;
  }

  private initializeSentry(): void {
    if (process.env.SENTRY_DSN) {
      const options: Options = {
        dsn: process.env.SENTRY_DSN,
        tracesSampleRate: 1.0,
        environment: process.env.NODE_ENV || 'development',
      };
      Sentry.init(options);
    }
  }

  public getRequestHandler(): RequestHandler {
    return Sentry.Handlers.requestHandler();
  }

  public getErrorHandler(): ErrorRequestHandler {
    return Sentry.Handlers.errorHandler();
  }

  public async close(): Promise<void> {
    await Sentry.close();
  }

  public captureException(error: Error): void {
    Sentry.captureException(error);
  }

  public captureMessage(message: string): void {
    Sentry.captureMessage(message);
  }

  public async logPerformanceMetric(metric: PerformanceMetric): Promise<void> {
    // Implementation needed
  }

  public async logResourceMetric(metric: ResourceMetric): Promise<void> {
    // Implementation needed
  }

  public trackHttpRequest(
    request: MonitoringRequest,
    response: MonitoringResponse,
    duration: number
  ): void {
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
    } catch (error) {
      logger.error('Failed to track request:', error);
    }
  }

  public trackDatabaseOperation(operation: string, collection: string, count: number): void {
    const metric: MetricData = {
      name: 'database_operation',
      value: count,
      labels: {
        operation,
        collection,
      },
    };
    this.recordMetric(metric);
  }

  public async getEndpointMetrics(startDate: Date, endDate: Date): Promise<EndpointMetric[]> {
    // Implementation needed
    return [];
  }

  public async getSystemMetrics(startDate: Date, endDate: Date): Promise<SystemMetric[]> {
    // Implementation needed
    return [];
  }

  public async getErrorDistribution(startDate: Date, endDate: Date): Promise<ErrorDistribution[]> {
    // Implementation needed
    return [];
  }

  public async getSlowEndpoints(startDate: Date, endDate: Date): Promise<SlowEndpoint[]> {
    // Implementation needed
    return [];
  }

  public recordError(name: string, error: Error): void {
    logger.error(`${name} error:`, error);
    this.captureException(error);
  }

  public recordMetric(metric: MetricData): void {
    const { name, value, labels = {} } = metric;
    const labelString = Object.entries(labels)
      .map(([k, v]) => `${k}="${v}"`)
      .join(',');
    
    const key = labelString ? `${name}{${labelString}}` : name;
    this.metrics.set(key, value);
  }

  public recordEvent(name: string, data: Record<string, any>): void {
    // Implementation needed
  }

  private incrementMetric(key: string): void {
    const currentValue = this.metrics.get(key) || 0;
    this.metrics.set(key, currentValue + 1);
  }

  private recordDuration(key: string, duration: number): void {
    const currentTotal = this.metrics.get(`${key}_total`) || 0;
    const currentCount = this.metrics.get(`${key}_count`) || 0;
    
    this.metrics.set(`${key}_total`, currentTotal + duration);
    this.metrics.set(`${key}_count`, currentCount + 1);
  }

  getMetrics(): Record<string, number> {
    return Object.fromEntries(this.metrics);
  }

  resetMetrics(): void {
    this.metrics.clear();
  }
}

export const monitoring = MonitoringService.getInstance();

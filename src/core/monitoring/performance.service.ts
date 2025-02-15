import { performance } from 'perf_hooks';
import { EventEmitter } from 'events';
import { Logger } from '../logger/logger';

interface Metric {
  name: string;
  value: number;
  tags: Record<string, string>;
  timestamp: number;
}

interface Trace {
  id: string;
  parentId?: string;
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  status: 'started' | 'completed' | 'error';
  error?: Error;
  tags: Record<string, string>;
  spans: Span[];
}

interface Span {
  id: string;
  traceId: string;
  parentId?: string;
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  status: 'started' | 'completed' | 'error';
  error?: Error;
  tags: Record<string, string>;
}

export class PerformanceService extends EventEmitter {
  private static instance: PerformanceService;
  private readonly logger: Logger;
  private readonly metrics: Metric[] = [];
  private readonly traces: Map<string, Trace> = new Map();
  private readonly spans: Map<string, Span> = new Map();
  private readonly metricsFlushInterval: NodeJS.Timeout;
  private readonly retentionPeriod = 24 * 60 * 60 * 1000; // 24 hours

  private constructor() {
    super();
    this.logger = new Logger('PerformanceService');

    // Setup periodic metrics flushing
    this.metricsFlushInterval = setInterval(() => {
      this.flushMetrics();
    }, 60000); // Flush every minute

    // Setup cleanup of old traces
    setInterval(() => {
      this.cleanupOldTraces();
    }, 3600000); // Cleanup every hour
  }

  static getInstance(): PerformanceService {
    if (!PerformanceService.instance) {
      PerformanceService.instance = new PerformanceService();
    }
    return PerformanceService.instance;
  }

  // Metrics
  recordMetric(name: string, value: number, tags: Record<string, string> = {}): void {
    this.metrics.push({
      name,
      value,
      tags,
      timestamp: Date.now()
    });

    this.emit('metric', {
      name,
      value,
      tags,
      timestamp: Date.now()
    });
  }

  getMetrics(
    filter: {
      name?: string;
      tags?: Record<string, string>;
      startTime?: number;
      endTime?: number;
    } = {}
  ): Metric[] {
    return this.metrics.filter(metric => {
      if (filter.name && metric.name !== filter.name) {
        return false;
      }
      if (filter.startTime && metric.timestamp < filter.startTime) {
        return false;
      }
      if (filter.endTime && metric.timestamp > filter.endTime) {
        return false;
      }
      if (filter.tags) {
        return Object.entries(filter.tags).every(
          ([key, value]) => metric.tags[key] === value
        );
      }
      return true;
    });
  }

  // Tracing
  startTrace(
    name: string,
    tags: Record<string, string> = {},
    parentId?: string
  ): string {
    const traceId = this.generateId();
    const trace: Trace = {
      id: traceId,
      parentId,
      name,
      startTime: performance.now(),
      status: 'started',
      tags,
      spans: []
    };

    this.traces.set(traceId, trace);
    this.emit('traceStarted', trace);

    return traceId;
  }

  endTrace(traceId: string, error?: Error): void {
    const trace = this.traces.get(traceId);
    if (!trace) {
      return;
    }

    trace.endTime = performance.now();
    trace.duration = trace.endTime - trace.startTime;
    trace.status = error ? 'error' : 'completed';
    trace.error = error;

    this.emit('traceEnded', trace);
  }

  startSpan(
    traceId: string,
    name: string,
    tags: Record<string, string> = {},
    parentId?: string
  ): string {
    const trace = this.traces.get(traceId);
    if (!trace) {
      throw new Error(`Trace ${traceId} not found`);
    }

    const spanId = this.generateId();
    const span: Span = {
      id: spanId,
      traceId,
      parentId,
      name,
      startTime: performance.now(),
      status: 'started',
      tags
    };

    this.spans.set(spanId, span);
    trace.spans.push(span);
    this.emit('spanStarted', span);

    return spanId;
  }

  endSpan(spanId: string, error?: Error): void {
    const span = this.spans.get(spanId);
    if (!span) {
      return;
    }

    span.endTime = performance.now();
    span.duration = span.endTime - span.startTime;
    span.status = error ? 'error' : 'completed';
    span.error = error;

    this.emit('spanEnded', span);
  }

  getTrace(traceId: string): Trace | undefined {
    return this.traces.get(traceId);
  }

  getTraces(
    filter: {
      name?: string;
      tags?: Record<string, string>;
      status?: 'started' | 'completed' | 'error';
      startTime?: number;
      endTime?: number;
    } = {}
  ): Trace[] {
    return Array.from(this.traces.values()).filter(trace => {
      if (filter.name && trace.name !== filter.name) {
        return false;
      }
      if (filter.status && trace.status !== filter.status) {
        return false;
      }
      if (filter.startTime && trace.startTime < filter.startTime) {
        return false;
      }
      if (filter.endTime && trace.endTime && trace.endTime > filter.endTime) {
        return false;
      }
      if (filter.tags) {
        return Object.entries(filter.tags).every(
          ([key, value]) => trace.tags[key] === value
        );
      }
      return true;
    });
  }

  // Utility methods
  private generateId(): string {
    return Math.random().toString(36).substring(2, 15);
  }

  private flushMetrics(): void {
    if (this.metrics.length === 0) {
      return;
    }

    try {
      // Here you would typically send metrics to your monitoring system
      // For now, we'll just log them
      this.logger.debug('Flushing metrics', {
        count: this.metrics.length,
        metrics: this.metrics
      });

      // Clear metrics after successful flush
      this.metrics.length = 0;
    } catch (err) {
      this.logger.error('Failed to flush metrics', {
        error: err instanceof Error ? err : String(err)
      });
    }
  }

  private cleanupOldTraces(): void {
    const cutoff = Date.now() - this.retentionPeriod;
    
    for (const [traceId, trace] of this.traces.entries()) {
      if (trace.endTime && trace.endTime < cutoff) {
        this.traces.delete(traceId);
        
        // Cleanup associated spans
        for (const span of trace.spans) {
          this.spans.delete(span.id);
        }
      }
    }
  }

  async shutdown(): Promise<void> {
    clearInterval(this.metricsFlushInterval);
    await this.flushMetrics();
  }
} 
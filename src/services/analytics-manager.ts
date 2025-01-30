import { getDb } from '../config/db.js';
import { ObjectId } from 'mongodb';

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

class AnalyticsManager {
  public readonly eventTypes: EventTypes = {
    PAGE_VIEW: 'page_view',
    API_CALL: 'api_call',
    USER_ACTION: 'user_action',
    ERROR: 'error',
    PERFORMANCE: 'performance'
  };

  public readonly metricTypes: MetricTypes = {
    COUNTER: 'counter',
    GAUGE: 'gauge',
    HISTOGRAM: 'histogram',
    SUMMARY: 'summary'
  };

  async trackEvent(type: string, data: any, metadata: Omit<EventMetadata, 'timestamp'> = {}): Promise<Event> {
    try {
      const db = await getDb();
      const event: Event = {
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
    } catch (err) {
      console.error('Error tracking event:', err);
      throw err;
    }
  }

  async trackMetric(
    name: string,
    value: number,
    type: string = this.metricTypes.GAUGE,
    labels: Record<string, string> = {}
  ): Promise<Metric> {
    try {
      const db = await getDb();
      const metric: Metric = {
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
    } catch (err) {
      console.error('Error tracking metric:', err);
      throw err;
    }
  }

  private async shouldAggregate(type: string): Promise<boolean> {
    // Determine if event type needs aggregation
    return ['page_view', 'api_call'].includes(type);
  }

  private async updateAggregates(type: string, data: any, metadata: EventMetadata): Promise<void> {
    const db = await getDb();
    const hour = new Date(metadata.timestamp);
    hour.setMinutes(0, 0, 0);

    const key = {
      type,
      hour,
      ...this.getAggregateKey(type, data)
    };

    await db.collection('analytics_aggregates').updateOne(
      key,
      {
        $inc: { count: 1 },
        $set: { lastUpdated: new Date() }
      },
      { upsert: true }
    );
  }

  private getAggregateKey(type: string, data: any): Record<string, any> {
    switch (type) {
      case 'page_view':
        return { path: data.path };
      case 'api_call':
        return { endpoint: data.endpoint, method: data.method };
      default:
        return {};
    }
  }

  private async updateMetricSummary(
    name: string,
    value: number,
    type: string,
    labels: Record<string, string>
  ): Promise<void> {
    const db = await getDb();
    const hour = new Date();
    hour.setMinutes(0, 0, 0);

    const summary = {
      name,
      type,
      labels,
      hour
    };

    interface MetricUpdate {
      count: number;
      sum: number;
      min: number;
      max: number;
      buckets?: Record<string, number>;
    }

    const update = {
      $inc: { count: 1, sum: value } as Record<string, number>,
      $min: { min: value },
      $max: { max: value },
      $set: { lastUpdated: new Date() }
    };

    if (type === this.metricTypes.HISTOGRAM) {
      const bucket = this.getBucket(value);
      update.$inc[`buckets.${bucket}`] = 1;
    }

    await db.collection('metric_summaries').updateOne(
      summary,
      update as any,
      { upsert: true }
    );
  }

  private getBucket(value: number): string {
    // Implement bucketing logic based on your needs
    const buckets = [0, 10, 100, 1000, 10000];
    return buckets.find(b => value <= b)?.toString() || 'inf';
  }
}

export default new AnalyticsManager(); 
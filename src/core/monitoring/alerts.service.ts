import { EventEmitter } from 'events';
import { PerformanceService } from './performance.service';
import { Logger } from '../logger/logger';

interface AlertRule {
  id: string;
  name: string;
  description: string;
  metric: string;
  condition: 'gt' | 'lt' | 'eq';
  threshold: number;
  duration: number;
  cooldown: number;
  tags?: Record<string, string>;
  enabled: boolean;
}

interface Alert {
  id: string;
  ruleId: string;
  message: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  metric: string;
  value: number;
  threshold: number;
  timestamp: number;
  tags?: Record<string, string>;
}

interface AlertState {
  ruleId: string;
  violations: number;
  lastTriggered?: number;
  lastValue?: number;
}

export class AlertsService extends EventEmitter {
  private static instance: AlertsService;
  private readonly performanceService: PerformanceService;
  private readonly logger: Logger;
  private readonly rules: Map<string, AlertRule> = new Map();
  private readonly state: Map<string, AlertState> = new Map();
  private readonly alerts: Alert[] = [];
  private readonly checkInterval: NodeJS.Timeout;

  private constructor() {
    super();
    this.performanceService = PerformanceService.getInstance();
    this.logger = new Logger('AlertsService');

    // Setup default rules
    this.setupDefaultRules();

    // Start monitoring
    this.checkInterval = setInterval(() => {
      this.checkRules();
    }, 60000); // Check every minute

    // Listen for performance events
    this.performanceService.on('metric', (metric) => {
      this.processMetric(metric);
    });
  }

  static getInstance(): AlertsService {
    if (!AlertsService.instance) {
      AlertsService.instance = new AlertsService();
    }
    return AlertsService.instance;
  }

  private setupDefaultRules(): void {
    this.addRule({
      id: 'high-latency',
      name: 'High Latency',
      description: 'Average request latency exceeds threshold',
      metric: 'http_request_duration',
      condition: 'gt',
      threshold: 1000, // 1 second
      duration: 300000, // 5 minutes
      cooldown: 1800000, // 30 minutes
      enabled: true
    });

    this.addRule({
      id: 'error-rate',
      name: 'High Error Rate',
      description: 'Error rate exceeds threshold',
      metric: 'errors',
      condition: 'gt',
      threshold: 0.05, // 5%
      duration: 300000, // 5 minutes
      cooldown: 1800000, // 30 minutes
      enabled: true
    });

    this.addRule({
      id: 'db-operations',
      name: 'Excessive DB Operations',
      description: 'Number of database operations exceeds threshold',
      metric: 'database_operations',
      condition: 'gt',
      threshold: 1000,
      duration: 300000, // 5 minutes
      cooldown: 1800000, // 30 minutes
      enabled: true
    });
  }

  addRule(rule: AlertRule): void {
    this.rules.set(rule.id, rule);
    this.state.set(rule.id, { ruleId: rule.id, violations: 0 });
    this.logger.info('Alert rule added', { ruleId: rule.id });
  }

  removeRule(ruleId: string): void {
    this.rules.delete(ruleId);
    this.state.delete(ruleId);
    this.logger.info('Alert rule removed', { ruleId });
  }

  private async checkRules(): Promise<void> {
    const now = Date.now();
    const enabledRules = Array.from(this.rules.values()).filter(r => r.enabled);

    for (const rule of enabledRules) {
      try {
        const metrics = this.performanceService.getMetrics({
          name: rule.metric,
          tags: rule.tags,
          startTime: now - rule.duration
        });

        if (metrics.length === 0) {
          continue;
        }

        const average = metrics.reduce((sum, m) => sum + m.value, 0) / metrics.length;
        const state = this.state.get(rule.id)!;

        if (this.checkThreshold(average, rule.threshold, rule.condition)) {
          state.violations++;
          state.lastValue = average;

          if (state.violations >= 3 && this.canTrigger(state, rule.cooldown)) {
            this.triggerAlert(rule, average);
            state.lastTriggered = now;
            state.violations = 0;
          }
        } else {
          state.violations = Math.max(0, state.violations - 1);
        }
      } catch (err) {
        this.logger.error('Failed to check rule', {
          error: err instanceof Error ? err : String(err),
          ruleId: rule.id
        });
      }
    }
  }

  private processMetric(metric: any): void {
    const relevantRules = Array.from(this.rules.values()).filter(rule => 
      rule.enabled && 
      rule.metric === metric.name &&
      (!rule.tags || Object.entries(rule.tags).every(([key, value]) => metric.tags[key] === value))
    );

    for (const rule of relevantRules) {
      const state = this.state.get(rule.id)!;
      
      if (this.checkThreshold(metric.value, rule.threshold, rule.condition)) {
        state.violations++;
        state.lastValue = metric.value;

        if (state.violations >= 3 && this.canTrigger(state, rule.cooldown)) {
          this.triggerAlert(rule, metric.value);
          state.lastTriggered = Date.now();
          state.violations = 0;
        }
      }
    }
  }

  private checkThreshold(value: number, threshold: number, condition: 'gt' | 'lt' | 'eq'): boolean {
    switch (condition) {
      case 'gt': return value > threshold;
      case 'lt': return value < threshold;
      case 'eq': return value === threshold;
      default: return false;
    }
  }

  private canTrigger(state: AlertState, cooldown: number): boolean {
    if (!state.lastTriggered) {
      return true;
    }
    return Date.now() - state.lastTriggered >= cooldown;
  }

  private triggerAlert(rule: AlertRule, value: number): void {
    const alert: Alert = {
      id: Math.random().toString(36).substring(2, 15),
      ruleId: rule.id,
      message: `${rule.name}: ${rule.description} (${value} ${rule.condition} ${rule.threshold})`,
      severity: this.calculateSeverity(value, rule.threshold, rule.condition),
      metric: rule.metric,
      value,
      threshold: rule.threshold,
      timestamp: Date.now(),
      tags: rule.tags
    };

    this.alerts.push(alert);
    this.emit('alert', alert);
    this.logger.warn('Alert triggered', alert);

    // Keep only last 1000 alerts
    if (this.alerts.length > 1000) {
      this.alerts.shift();
    }
  }

  private calculateSeverity(
    value: number,
    threshold: number,
    condition: 'gt' | 'lt' | 'eq'
  ): 'info' | 'warning' | 'error' | 'critical' {
    const ratio = condition === 'gt' 
      ? value / threshold 
      : threshold / value;

    if (ratio >= 2) return 'critical';
    if (ratio >= 1.5) return 'error';
    if (ratio >= 1.2) return 'warning';
    return 'info';
  }

  getAlerts(
    filter: {
      severity?: 'info' | 'warning' | 'error' | 'critical';
      metric?: string;
      startTime?: number;
      endTime?: number;
      ruleId?: string;
    } = {}
  ): Alert[] {
    return this.alerts.filter(alert => {
      if (filter.severity && alert.severity !== filter.severity) {
        return false;
      }
      if (filter.metric && alert.metric !== filter.metric) {
        return false;
      }
      if (filter.startTime && alert.timestamp < filter.startTime) {
        return false;
      }
      if (filter.endTime && alert.timestamp > filter.endTime) {
        return false;
      }
      if (filter.ruleId && alert.ruleId !== filter.ruleId) {
        return false;
      }
      return true;
    });
  }

  getRules(): AlertRule[] {
    return Array.from(this.rules.values());
  }

  async shutdown(): Promise<void> {
    clearInterval(this.checkInterval);
  }
} 
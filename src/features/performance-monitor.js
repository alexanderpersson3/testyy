import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';
import { createStructuredLog } from '../config/cloud.js';

class PerformanceMonitor extends EventEmitter {
  constructor() {
    super();
    this.metrics = new Map();
    this.thresholds = {
      responseTime: 1000, // 1 second
      memoryUsage: 1024 * 1024 * 512, // 512MB
      cpuUsage: 80, // 80%
    };
  }

  // Start timing a request
  startRequest(req) {
    req.startTime = performance.now();
    req.startCpu = process.cpuUsage();
    req.startMem = process.memoryUsage();
  }

  // End timing and collect metrics
  endRequest(req, res) {
    const endTime = performance.now();
    const duration = endTime - req.startTime;
    const endCpu = process.cpuUsage(req.startCpu);
    const endMem = process.memoryUsage();

    const metrics = {
      path: req.path,
      method: req.method,
      statusCode: res.statusCode,
      duration,
      timestamp: new Date(),
      cpu: {
        user: endCpu.user,
        system: endCpu.system,
      },
      memory: {
        heapUsed: endMem.heapUsed - req.startMem.heapUsed,
        heapTotal: endMem.heapTotal,
        external: endMem.external,
        rss: endMem.rss,
      },
    };

    this.recordMetrics(metrics);
    return metrics;
  }

  // Record metrics
  recordMetrics(metrics) {
    const key = `${metrics.method}:${metrics.path}`;
    if (!this.metrics.has(key)) {
      this.metrics.set(key, []);
    }

    const routeMetrics = this.metrics.get(key);
    routeMetrics.push(metrics);

    // Keep only last 1000 metrics per route
    if (routeMetrics.length > 1000) {
      routeMetrics.shift();
    }

    // Check thresholds
    this.checkThresholds(metrics);

    // Log metrics
    createStructuredLog('performance_metrics', metrics);
  }

  // Check if metrics exceed thresholds
  checkThresholds(metrics) {
    if (metrics.duration > this.thresholds.responseTime) {
      this.emit('slowResponse', {
        ...metrics,
        threshold: this.thresholds.responseTime,
      });
    }

    if (metrics.memory.heapUsed > this.thresholds.memoryUsage) {
      this.emit('highMemory', {
        ...metrics,
        threshold: this.thresholds.memoryUsage,
      });
    }

    const cpuUsage = (metrics.cpu.user + metrics.cpu.system) / 1000000; // Convert to percentage
    if (cpuUsage > this.thresholds.cpuUsage) {
      this.emit('highCpu', {
        ...metrics,
        cpuUsage,
        threshold: this.thresholds.cpuUsage,
      });
    }
  }

  // Get route statistics
  getRouteStats(method, path) {
    const key = `${method}:${path}`;
    const metrics = this.metrics.get(key) || [];

    if (metrics.length === 0) {
      return null;
    }

    const durations = metrics.map(m => m.duration);
    return {
      path,
      method,
      count: metrics.length,
      avgResponseTime: durations.reduce((a, b) => a + b, 0) / metrics.length,
      minResponseTime: Math.min(...durations),
      maxResponseTime: Math.max(...durations),
      p95ResponseTime: this.calculatePercentile(durations, 95),
      lastTimestamp: metrics[metrics.length - 1].timestamp,
    };
  }

  // Calculate percentile
  calculatePercentile(values, percentile) {
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[index];
  }

  // Get all route statistics
  getAllRouteStats() {
    const stats = {};
    for (const [key, _] of this.metrics) {
      const [method, path] = key.split(':');
      stats[key] = this.getRouteStats(method, path);
    }
    return stats;
  }

  // Update thresholds
  setThresholds(newThresholds) {
    this.thresholds = {
      ...this.thresholds,
      ...newThresholds,
    };
  }

  // Clear metrics
  clearMetrics() {
    this.metrics.clear();
  }
}

// Create singleton instance
const monitor = new PerformanceMonitor();

// Export performance monitoring middleware
export const performanceMiddleware = (req, res, next) => {
  monitor.startRequest(req);

  res.on('finish', () => {
    monitor.endRequest(req, res);
  });

  next();
};

export default monitor;

import { performance } from 'perf_hooks';
import { createStructuredLog } from '../config/cloud';
import monitor from '../services/performance-monitor';
import { OperationType, PerformanceMetrics, PerformanceError } from '../../types/performance';

// Operation types
export const OperationTypes: Record<string, OperationType> = {
  DATABASE_QUERY: 'database_query',
  CACHE_OPERATION: 'cache_operation',
  API_REQUEST: 'api_request',
  FILE_OPERATION: 'file_operation',
  AUTHENTICATION: 'authentication',
  BACKGROUND_TASK: 'background_task',
};

// Performance tracking wrapper
export const trackPerformance = async <T>(
  operationType: OperationType,
  operationName: string,
  operation: () => Promise<T>,
  metadata: Record<string, any> = {}
): Promise<T> => {
  const startTime = performance.now();
  const startMemory = process.memoryUsage();
  const startCpu = process.cpuUsage();

  try {
    const result = await operation();

    const endTime = performance.now();
    const duration = endTime - startTime;
    const endMemory = process.memoryUsage();
    const endCpu = process.cpuUsage(startCpu);

    const metrics: PerformanceMetrics = {
      operationType,
      operationName,
      duration,
      timestamp: new Date(),
      success: true,
      memory: {
        heapUsed: endMemory.heapUsed - startMemory.heapUsed,
        heapTotal: endMemory.heapTotal,
        external: endMemory.external,
        rss: endMemory.rss,
      },
      cpu: {
        user: endCpu.user,
        system: endCpu.system,
      },
      ...metadata,
    };

    createStructuredLog('performance_metrics', metrics);

    // Emit performance event if threshold exceeded
    if (duration > monitor.thresholds.responseTime) {
      monitor.emit('slowOperation', {
        ...metrics,
        threshold: monitor.thresholds.responseTime,
      });
    }

    return result;
  } catch (error) {
    const endTime = performance.now();
    const duration = endTime - startTime;

    const errorMetrics: PerformanceError = {
      operationType,
      operationName,
      duration,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      ...metadata,
    };

    createStructuredLog('performance_error', errorMetrics);

    throw error;
  }
};

// Database operation tracker
export const trackDatabaseOperation = <T>(
  operationName: string,
  operation: () => Promise<T>,
  metadata: Record<string, any> = {}
): Promise<T> => {
  return trackPerformance(OperationTypes.DATABASE_QUERY, operationName, operation, metadata);
};

// Cache operation tracker
export const trackCacheOperation = <T>(
  operationName: string,
  operation: () => Promise<T>,
  metadata: Record<string, any> = {}
): Promise<T> => {
  return trackPerformance(OperationTypes.CACHE_OPERATION, operationName, operation, metadata);
};

// API request tracker
export const trackApiRequest = <T>(
  operationName: string,
  operation: () => Promise<T>,
  metadata: Record<string, any> = {}
): Promise<T> => {
  return trackPerformance(OperationTypes.API_REQUEST, operationName, operation, metadata);
};

// Performance event handlers
monitor.on('slowOperation', (data: PerformanceMetrics) => {
  createStructuredLog('performance_alert', {
    type: 'slow_operation',
    ...data,
  });
});

monitor.on('highMemory', (data: PerformanceMetrics) => {
  createStructuredLog('performance_alert', {
    type: 'high_memory',
    ...data,
  });
});

monitor.on('highCpu', (data: PerformanceMetrics) => {
  createStructuredLog('performance_alert', {
    type: 'high_cpu',
    ...data,
  });
}); 
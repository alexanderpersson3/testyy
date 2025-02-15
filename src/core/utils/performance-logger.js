import { performance } from 'perf_hooks';
import { createStructuredLog } from '../config/cloud.js';
import monitor from '../services/performance-monitor.js';

// Operation types
export const OperationType = {
  DATABASE_QUERY: 'database_query',
  CACHE_OPERATION: 'cache_operation',
  API_REQUEST: 'api_request',
  FILE_OPERATION: 'file_operation',
  AUTHENTICATION: 'authentication',
  BACKGROUND_TASK: 'background_task',
};

// Performance tracking wrapper
export const trackPerformance = async (operationType, operationName, operation, metadata = {}) => {
  const startTime = performance.now();
  const startMemory = process.memoryUsage();
  const startCpu = process.cpuUsage();

  try {
    const result = await operation();

    const endTime = performance.now();
    const duration = endTime - startTime;
    const endMemory = process.memoryUsage();
    const endCpu = process.cpuUsage(startCpu);

    const metrics = {
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

    createStructuredLog('performance_error', {
      operationType,
      operationName,
      duration,
      error: error.message,
      stack: error.stack,
      ...metadata,
    });

    throw error;
  }
};

// Database operation tracker
export const trackDatabaseOperation = (operationName, operation, metadata = {}) => {
  return trackPerformance(OperationType.DATABASE_QUERY, operationName, operation, metadata);
};

// Cache operation tracker
export const trackCacheOperation = (operationName, operation, metadata = {}) => {
  return trackPerformance(OperationType.CACHE_OPERATION, operationName, operation, metadata);
};

// API request tracker
export const trackApiRequest = (operationName, operation, metadata = {}) => {
  return trackPerformance(OperationType.API_REQUEST, operationName, operation, metadata);
};

// Performance event handlers
monitor.on('slowOperation', data => {
  createStructuredLog('performance_alert', {
    type: 'slow_operation',
    ...data,
  });
});

monitor.on('highMemory', data => {
  createStructuredLog('performance_alert', {
    type: 'high_memory',
    ...data,
  });
});

monitor.on('highCpu', data => {
  createStructuredLog('performance_alert', {
    type: 'high_cpu',
    ...data,
  });
});

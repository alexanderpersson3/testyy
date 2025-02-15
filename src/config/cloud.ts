import { PerformanceMetrics, PerformanceError } from '../types/performance';

export type LogType = 
  | 'performance_metrics'
  | 'performance_error'
  | 'performance_alert'
  | 'cache_hit'
  | 'cache_miss'
  | 'cache_store'
  | 'cache_error'
  | 'cache_invalidate'
  | 'cache_batch_get'
  | 'cache_warm'
  | 'cache_stats';

interface StructuredLogData {
  type: LogType;
  timestamp: string;
  [key: string]: any;
}

export const createStructuredLog = (type: LogType, data: Record<string, any>): void => {
  const log: StructuredLogData = {
    type,
    timestamp: new Date().toISOString(),
    ...data,
  };

  // In development, just console.log
  if (process.env.NODE_ENV === 'development') {
    console.log(JSON.stringify(log, null, 2));
    return;
  }

  // In production, this would send to a proper logging service
  // For now, we'll just use console.log
  console.log(JSON.stringify(log));
}; 
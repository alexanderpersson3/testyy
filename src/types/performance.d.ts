export interface PerformanceMetrics {
  operationType: string;
  operationName: string;
  duration: number;
  timestamp: Date;
  success: boolean;
  memory: {
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
  };
  cpu: {
    user: number;
    system: number;
  };
  [key: string]: any;
}

export interface PerformanceError {
  operationType: string;
  operationName: string;
  duration: number;
  error: string;
  stack?: string;
  [key: string]: any;
}

export interface PerformanceMonitor {
  thresholds: {
    responseTime: number;
    memoryUsage: number;
    cpuUsage: number;
  };
  emit(event: string, data: any): void;
  on(event: string, listener: (data: any) => void): void;
}

export type OperationType = 
  | 'database_query'
  | 'cache_operation'
  | 'api_request'
  | 'file_operation'
  | 'authentication'
  | 'background_task'; 
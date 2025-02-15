# Error Monitoring Setup Guide

## Overview
This guide describes how to set up and configure error monitoring for the Rezepta Backend application. The monitoring system provides real-time error tracking, alerting, and analytics.

## Table of Contents
1. [Logging Configuration](#logging-configuration)
2. [Monitoring Setup](#monitoring-setup)
3. [Alert Configuration](#alert-configuration)
4. [Dashboard Setup](#dashboard-setup)
5. [Integration with External Services](#integration-with-external-services)

## Logging Configuration

### 1. Environment Variables
```bash
# Logging
LOG_LEVEL=info
LOG_FORMAT=json

# Google Cloud Logging
GOOGLE_CLOUD_PROJECT=your-project-id
GOOGLE_APPLICATION_CREDENTIALS=path/to/credentials.json

# Monitoring
ALERT_WEBHOOK_URL=https://your-webhook-url
ERROR_NOTIFICATION_EMAIL=alerts@company.com
```

### 2. Logging Levels
```javascript
// Configure logging levels
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  levels: {
    error: 0,    // Critical errors
    warn: 1,     // Operational errors
    info: 2,     // Important events
    debug: 3,    // Debugging information
    trace: 4     // Detailed tracing
  }
});
```

### 3. Log Rotation
```javascript
// Configure log rotation
logger.add(new winston.transports.File({
  filename: 'logs/error.log',
  level: 'error',
  maxsize: 5242880,    // 5MB
  maxFiles: 5,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  )
}));
```

## Monitoring Setup

### 1. Performance Monitoring
```javascript
// Configure performance thresholds
const performanceMonitor = new PerformanceMonitor({
  thresholds: {
    responseTime: 1000,        // 1 second
    memoryUsage: 512 * 1024 * 1024,  // 512MB
    cpuUsage: 80,             // 80%
    errorRate: 5              // 5% error rate
  },
  samplingRate: 0.1           // Sample 10% of requests
});
```

### 2. Error Rate Monitoring
```javascript
// Configure error rate monitoring
const errorMonitor = new ErrorMonitor({
  windowSize: 60 * 1000,      // 1 minute window
  errorThreshold: 10,         // Alert after 10 errors
  cooldown: 5 * 60 * 1000     // 5 minute cooldown
});

// Track error rates
errorMonitor.on('threshold_exceeded', (stats) => {
  createAlert('ERROR_RATE_HIGH', stats);
});
```

### 3. Resource Monitoring
```javascript
// Monitor system resources
const resourceMonitor = new ResourceMonitor({
  interval: 60 * 1000,        // Check every minute
  memoryThreshold: 0.8,       // 80% memory usage
  cpuThreshold: 0.7,          // 70% CPU usage
  diskThreshold: 0.9          // 90% disk usage
});
```

## Alert Configuration

### 1. Alert Levels
```javascript
// Configure alert levels
const alertLevels = {
  CRITICAL: {
    priority: 1,
    notification: ['email', 'sms', 'slack'],
    timeout: 5 * 60 * 1000  // 5 minutes
  },
  WARNING: {
    priority: 2,
    notification: ['email', 'slack'],
    timeout: 15 * 60 * 1000 // 15 minutes
  },
  INFO: {
    priority: 3,
    notification: ['slack'],
    timeout: 60 * 60 * 1000 // 1 hour
  }
};
```

### 2. Alert Rules
```javascript
// Configure alert rules
const alertRules = [
  {
    condition: (error) => error instanceof DatabaseError,
    level: 'CRITICAL',
    message: 'Database connection error detected'
  },
  {
    condition: (error) => error instanceof PerformanceError,
    level: 'WARNING',
    message: 'Performance degradation detected'
  }
];
```

### 3. Notification Channels
```javascript
// Configure notification channels
const notificationChannels = {
  email: {
    service: 'smtp',
    config: {
      host: 'smtp.company.com',
      port: 587,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    }
  },
  slack: {
    webhook: process.env.SLACK_WEBHOOK_URL,
    channel: '#alerts'
  }
};
```

## Dashboard Setup

### 1. Metrics Configuration
```javascript
// Configure metrics collection
const metrics = {
  errorRate: {
    type: 'counter',
    labels: ['status', 'endpoint']
  },
  responseTime: {
    type: 'histogram',
    buckets: [50, 100, 200, 500, 1000]
  },
  memoryUsage: {
    type: 'gauge'
  }
};
```

### 2. Dashboard Panels
```javascript
// Configure dashboard panels
const dashboardPanels = [
  {
    title: 'Error Rate',
    metric: 'errorRate',
    type: 'line',
    interval: '5m'
  },
  {
    title: 'Response Time',
    metric: 'responseTime',
    type: 'heatmap',
    interval: '1m'
  }
];
```

### 3. Alert Visualization
```javascript
// Configure alert visualization
const alertVisualization = {
  groupBy: ['errorCode', 'service'],
  timeRange: '24h',
  refreshInterval: '1m'
};
```

## Integration with External Services

### 1. Google Cloud Monitoring
```javascript
// Configure Google Cloud Monitoring
const monitoring = new MetricServiceClient({
  projectId: process.env.GOOGLE_CLOUD_PROJECT,
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS
});

// Create custom metric
const createCustomMetric = async () => {
  await monitoring.createMetricDescriptor({
    name: 'custom.googleapis.com/error_rate',
    displayName: 'Error Rate',
    type: 'custom.googleapis.com/error_rate',
    metricKind: 'GAUGE',
    valueType: 'DOUBLE',
    unit: '1/s',
    description: 'Application error rate'
  });
};
```

### 2. Error Tracking Services
```javascript
// Configure error tracking
const errorTracking = {
  sentry: {
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV,
    tracesSampleRate: 0.1
  },
  rollbar: {
    accessToken: process.env.ROLLBAR_TOKEN,
    environment: process.env.NODE_ENV,
    captureUncaught: true
  }
};
```

### 3. Alerting Integration
```javascript
// Configure alert integration
const alertIntegration = {
  pagerduty: {
    serviceKey: process.env.PAGERDUTY_KEY,
    severity: {
      CRITICAL: 'P1',
      WARNING: 'P2',
      INFO: 'P3'
    }
  },
  opsgenie: {
    apiKey: process.env.OPSGENIE_KEY,
    tags: ['backend', 'production']
  }
};
``` 
import { CloudTasksClient, protos } from '@google-cloud/tasks';
import { createStructuredLog, reportError } from './cloud';
import { Request, Response, NextFunction } from 'express';

interface RateLimits {
  maxConcurrentDispatches: number;
  maxDispatchesPerSecond: number;
}

interface RetryConfig {
  maxAttempts: number;
  minBackoff: { seconds: number };
  maxBackoff: { seconds: number };
  maxDoublings: number;
} 

interface QueueConfig {
  name: string;
  rateLimits: RateLimits;
  retryConfig: RetryConfig;
}

interface QueueConfigs {
  [key: string]: QueueConfig;
}

const QUEUE_CONFIGS: QueueConfigs = {
  email: {
    name: 'email-queue',
    rateLimits: {
      maxConcurrentDispatches: 100,
      maxDispatchesPerSecond: 500,
    },
    retryConfig: {
      maxAttempts: 5,
      minBackoff: { seconds: 10 },
      maxBackoff: { seconds: 300 },
      maxDoublings: 4
    },
  },
  notification: {
    name: 'notification-queue',
    rateLimits: {
      maxConcurrentDispatches: 200,
      maxDispatchesPerSecond: 1000,
    },
    retryConfig: {
      maxAttempts: 3,
      minBackoff: { seconds: 5 },
      maxBackoff: { seconds: 60 },
      maxDoublings: 3
    },
  },
  analytics: {
    name: 'analytics-queue',
    rateLimits: {
      maxConcurrentDispatches: 50,
      maxDispatchesPerSecond: 100,
    },
    retryConfig: {
      maxAttempts: 2,
      minBackoff: { seconds: 30 },
      maxBackoff: { seconds: 120 },
      maxDoublings: 2
    },
  },
};

// Mock mode configuration
const MOCK_MODE = process.env.NODE_ENV === 'test';

// Production environment validation
if (!MOCK_MODE) {
  const requiredVars = ['GOOGLE_CLOUD_PROJECT', 'CLOUD_TASKS_SERVICE_ACCOUNT'];
  requiredVars.forEach(varName => {
    if (!process.env[varName]) throw new Error(`Missing required environment variable: ${varName}`);
  });
  console.warn('Cloud Tasks operating in production mode');
}

class TaskManager {
  private project: string | undefined;
  private location: string;
  private serviceAccountEmail: string | undefined;
  private client: CloudTasksClient;

  constructor() {
    this.project = process.env.GOOGLE_CLOUD_PROJECT;
    this.location = process.env.CLOUD_TASKS_LOCATION || 'us-central1';
    this.serviceAccountEmail = process.env.CLOUD_TASKS_SERVICE_ACCOUNT;
    this.client = new CloudTasksClient();
  }

  // Client accessor with mock support
  get clientInstance(): CloudTasksClient | any {
    if (MOCK_MODE) {
      return {
        locationPath: (p: string, l: string) => `projects/${p}/locations/${l}`,
        queuePath: (p: string, l: string, n: string) => `projects/${p}/locations/${l}/queues/${n}`,
        createQueue: () => [{}],
        createTask: () => [{}],
        deleteTask: () => {},
        listTasks: () => [],
        pauseQueue: () => {},
        resumeQueue: () => {},
      };
    }
    return this.client;
  }

  async createQueue(queueType: string): Promise<any> {
    if (MOCK_MODE) return {};
    const config = QUEUE_CONFIGS[queueType];
    if (!config) {
      throw new Error(`Invalid queue type: ${queueType}`);
    }

    const parent = this.clientInstance.locationPath(this.project!, this.location);
    const queue: protos.google.cloud.tasks.v2.IQueue = {
      name: this.clientInstance.queuePath(this.project!, this.location, config.name),
      rateLimits: config.rateLimits,
      retryConfig: config.retryConfig,
    };

    try {
      const [response] = await this.clientInstance.createQueue({ parent, queue });
      createStructuredLog('INFO', 'Queue created', { queueType, queueName: config.name });
      return response;
    } catch (error) {
      reportError(error, { queueType, queueName: config.name });
      throw error;
    }
  }

    async createTask(queueType: string, payload: any, options: { url?: string; scheduleTime?: Date } = {}): Promise<any> {
    if (MOCK_MODE) return { name: 'mock-task-id' };
    const config = QUEUE_CONFIGS[queueType];
    if (!config) {
      throw new Error(`Invalid queue type: ${queueType}`);
    }

    const parent = this.clientInstance.queuePath(this.project!, this.location, config.name);
        const task: protos.google.cloud.tasks.v2.ITask = {
      httpRequest: {
        httpMethod: 'POST' as any,
        url: options.url || `${process.env.API_BASE_URL}/tasks/${queueType}`,
        headers: {
          'Content-Type': 'application/json',
        },
        body: Buffer.from(JSON.stringify(payload)).toString('base64'),
        oidcToken: {
          serviceAccountEmail: this.serviceAccountEmail,
        },
      },
      scheduleTime: options.scheduleTime
        ? { seconds: options.scheduleTime.getTime() / 1000 }
        : undefined,
    };

    try {
      const [response] = await this.clientInstance.createTask({ parent, task });
      createStructuredLog('INFO', 'Task created', {
        queueType,
        taskName: response.name,
        payload: JSON.stringify(payload),
      });
      return response;
    } catch (error) {
      reportError(error, { queueType, payload });
      throw error;
    }
  }

  async deleteTask(queueType: string, taskName: string): Promise<void> {
    if (MOCK_MODE) return;
    try {
      await this.clientInstance.deleteTask({ name: taskName });
      createStructuredLog('INFO', 'Task deleted', { queueType, taskName });
    } catch (error) {
      reportError(error, { queueType, taskName });
      throw error;
    }
  }

  async listTasks(queueType: string): Promise<any[]> {
    if (MOCK_MODE) return [];
    const config = QUEUE_CONFIGS[queueType];
    if (!config) {
      throw new Error(`Invalid queue type: ${queueType}`);
    }

    const parent = this.clientInstance.queuePath(this.project!, this.location, config.name);
    try {
      const [tasks] = await this.clientInstance.listTasks({ parent });
      return tasks;
    } catch (error) {
      reportError(error, { queueType });
      throw error;
    }
  }

  async pauseQueue(queueType: string): Promise<void> {
    if (MOCK_MODE) return;
    const config = QUEUE_CONFIGS[queueType];
    if (!config) {
      throw new Error(`Invalid queue type: ${queueType}`);
    }

    const name = this.clientInstance.queuePath(this.project!, this.location, config.name);
    try {
      await this.clientInstance.pauseQueue({ name });
      createStructuredLog('INFO', 'Queue paused', { queueType });
    } catch (error) {
      reportError(error, { queueType });
      throw error;
    }
  }

  async resumeQueue(queueType: string): Promise<void> {
    if (MOCK_MODE) return;
    const config = QUEUE_CONFIGS[queueType];
    if (!config) {
      throw new Error(`Invalid queue type: ${queueType}`);
    }

    const name = this.clientInstance.queuePath(this.project!, this.location, config.name);
    try {
      await this.clientInstance.resumeQueue({ name });
      createStructuredLog('INFO', 'Queue resumed', { queueType });
    } catch (error) {
      reportError(error, { queueType });
      throw error;
    }
  }
}

export const taskManager = new TaskManager();
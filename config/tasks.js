import { CloudTasksClient } from '@google-cloud/tasks';
import { createStructuredLog, reportError } from './cloud.js';

const client = new CloudTasksClient();

const QUEUE_CONFIGS = {
  email: {
    name: 'email-queue',
    rateLimits: {
      maxConcurrentDispatches: 100,
      maxDispatchesPerSecond: 500
    },
    retryConfig: {
      maxAttempts: 5,
      minBackoff: '10s',
      maxBackoff: '300s',
      maxDoublings: 4
    }
  },
  notification: {
    name: 'notification-queue',
    rateLimits: {
      maxConcurrentDispatches: 200,
      maxDispatchesPerSecond: 1000
    },
    retryConfig: {
      maxAttempts: 3,
      minBackoff: '5s',
      maxBackoff: '60s',
      maxDoublings: 3
    }
  },
  analytics: {
    name: 'analytics-queue',
    rateLimits: {
      maxConcurrentDispatches: 50,
      maxDispatchesPerSecond: 100
    },
    retryConfig: {
      maxAttempts: 2,
      minBackoff: '30s',
      maxBackoff: '120s',
      maxDoublings: 2
    }
  }
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
  constructor() {
    this.project = process.env.GOOGLE_CLOUD_PROJECT;
    this.location = process.env.CLOUD_TASKS_LOCATION || 'us-central1';
    this.serviceAccountEmail = process.env.CLOUD_TASKS_SERVICE_ACCOUNT;
  }

  // Client accessor with mock support
  get client() {
    if (MOCK_MODE) {
      return {
        locationPath: (p, l) => `projects/${p}/locations/${l}`,
        queuePath: (p, l, n) => `projects/${p}/locations/${l}/queues/${n}`,
        createQueue: () => [{}],
        createTask: () => [{}],
        deleteTask: () => {},
        listTasks: () => [],
        pauseQueue: () => {},
        resumeQueue: () => {}
      };
    }
    return client;
  }

  async createQueue(queueType) {
    if (MOCK_MODE) return {};
    const config = QUEUE_CONFIGS[queueType];
    if (!config) {
      throw new Error(`Invalid queue type: ${queueType}`);
    }

    const parent = this.client.locationPath(this.project, this.location);
    const queue = {
      name: this.client.queuePath(this.project, this.location, config.name),
      rateLimits: config.rateLimits,
      retryConfig: config.retryConfig
    };

    try {
      const [response] = await this.client.createQueue({ parent, queue });
      createStructuredLog('INFO', 'Queue created', { queueType, queueName: config.name });
      return response;
    } catch (error) {
      reportError(error, { queueType, queueName: config.name });
      throw error;
    }
  }

  async createTask(queueType, payload, options = {}) {
    if (MOCK_MODE) return { name: 'mock-task-id' };
    const config = QUEUE_CONFIGS[queueType];
    if (!config) {
      throw new Error(`Invalid queue type: ${queueType}`);
    }

    const parent = this.client.queuePath(this.project, this.location, config.name);
    const task = {
      httpRequest: {
        httpMethod: 'POST',
        url: options.url || `${process.env.API_BASE_URL}/tasks/${queueType}`,
        headers: {
          'Content-Type': 'application/json'
        },
        body: Buffer.from(JSON.stringify(payload)).toString('base64'),
        oidcToken: {
          serviceAccountEmail: this.serviceAccountEmail
        }
      },
      scheduleTime: options.scheduleTime ? { seconds: options.scheduleTime.getTime() / 1000 } : null
    };

    try {
      const [response] = await this.client.createTask({ parent, task });
      createStructuredLog('INFO', 'Task created', { 
        queueType, 
        taskName: response.name,
        payload: JSON.stringify(payload)
      });
      return response;
    } catch (error) {
      reportError(error, { queueType, payload });
      throw error;
    }
  }

  async deleteTask(queueType, taskName) {
    if (MOCK_MODE) return;
    try {
      await this.client.deleteTask({ name: taskName });
      createStructuredLog('INFO', 'Task deleted', { queueType, taskName });
    } catch (error) {
      reportError(error, { queueType, taskName });
      throw error;
    }
  }

  async listTasks(queueType) {
    if (MOCK_MODE) return [];
    const config = QUEUE_CONFIGS[queueType];
    if (!config) {
      throw new Error(`Invalid queue type: ${queueType}`);
    }

    const parent = this.client.queuePath(this.project, this.location, config.name);
    try {
      const [tasks] = await this.client.listTasks({ parent });
      return tasks;
    } catch (error) {
      reportError(error, { queueType });
      throw error;
    }
  }

  async pauseQueue(queueType) {
    if (MOCK_MODE) return;
    const config = QUEUE_CONFIGS[queueType];
    if (!config) {
      throw new Error(`Invalid queue type: ${queueType}`);
    }

    const name = this.client.queuePath(this.project, this.location, config.name);
    try {
      await this.client.pauseQueue({ name });
      createStructuredLog('INFO', 'Queue paused', { queueType });
    } catch (error) {
      reportError(error, { queueType });
      throw error;
    }
  }

  async resumeQueue(queueType) {
    if (MOCK_MODE) return;
    const config = QUEUE_CONFIGS[queueType];
    if (!config) {
      throw new Error(`Invalid queue type: ${queueType}`);
    }

    const name = this.client.queuePath(this.project, this.location, config.name);
    try {
      await this.client.resumeQueue({ name });
      createStructuredLog('INFO', 'Queue resumed', { queueType });
    } catch (error) {
      reportError(error, { queueType });
      throw error;
    }
  }
}

export const taskManager = new TaskManager();
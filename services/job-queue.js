const Queue = require('bull');
const Redis = require('ioredis');
const { getDb } = require('../db');
const { ObjectId } = require('mongodb');
const auditLogger = require('./audit-logger');

class JobQueue {
  constructor() {
    // Initialize Redis client
    this.redisClient = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379,
      password: process.env.REDIS_PASSWORD,
      db: process.env.REDIS_DB || 0,
      maxRetriesPerRequest: null,
      enableReadyCheck: false
    });

    // Queue configurations
    this.queueConfigs = {
      media: {
        name: 'media',
        concurrency: 3,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000
        }
      },
      notifications: {
        name: 'notification',
        concurrency: 10,
        attempts: 3,
        backoff: {
          type: 'fixed',
          delay: 1000
        }
      },
      email: {
        name: 'email',
        concurrency: 5,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000
        }
      },
      analytics: {
        name: 'analytics',
        concurrency: 5,
        attempts: 2,
        backoff: {
          type: 'fixed',
          delay: 1000
        }
      },
      search: {
        name: 'search',
        concurrency: 3,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000
        }
      }
    };

    // Initialize queues
    this.queues = {};
    Object.values(this.queueConfigs).forEach(config => {
      this.queues[config.name] = this.createQueue(config);
    });

    // Set up error handling for all queues
    this.setupErrorHandling();

    // Set up metrics collection
    this.setupMetrics();
  }

  /**
   * Create a new queue
   */
  createQueue(config) {
    const queue = new Queue(config.name, {
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379,
        password: process.env.REDIS_PASSWORD,
        db: process.env.REDIS_DB || 0,
        maxRetriesPerRequest: null,
        enableReadyCheck: false
      },
      defaultJobOptions: {
        attempts: config.attempts,
        backoff: config.backoff,
        removeOnComplete: true,
        removeOnFail: false
      }
    });

    // Set concurrency
    queue.process(config.concurrency, (job) => {
      return this.processJob(job);
    });

    return queue;
  }

  /**
   * Add a job to a queue
   */
  async addJob(queueName, jobType, data, options = {}) {
    try {
      const queue = this.queues[queueName];
      if (!queue) {
        throw new Error(`Queue not found: ${queueName}`);
      }

      const job = await queue.add(
        {
          type: jobType,
          data
        },
        {
          priority: options.priority,
          delay: options.delay,
          attempts: options.attempts,
          backoff: options.backoff,
          timeout: options.timeout,
          jobId: options.jobId,
          removeOnComplete: options.removeOnComplete,
          removeOnFail: options.removeOnFail
        }
      );

      console.log(`Added job ${job.id} to queue ${queueName}`);
      return job;
    } catch (error) {
      console.error(`Error adding job to queue ${queueName}:`, error);
      throw error;
    }
  }

  /**
   * Process a job from any queue
   */
  async processJob(job) {
    console.log(`Processing job ${job.id} from queue ${job.queue.name}`);
    try {
      // The actual processing is handled by the specific processors
      // This method is just for logging and metrics
      await this.updateJobMetrics(job.queue.name, 'processing');
      return job;
    } catch (error) {
      console.error(`Error processing job ${job.id}:`, error);
      await this.updateJobMetrics(job.queue.name, 'failed');
      throw error;
    }
  }

  /**
   * Set up queue processor
   */
  processQueue(queueName, processor) {
    const queue = this.queues[queueName];
    if (!queue) {
      throw new Error(`Queue not found: ${queueName}`);
    }

    queue.process(async (job) => {
      try {
        await this.updateJobMetrics(queueName, 'processing');
        const result = await processor(job);
        await this.updateJobMetrics(queueName, 'completed');
        return result;
      } catch (error) {
        await this.updateJobMetrics(queueName, 'failed');
        throw error;
      }
    });
  }

  /**
   * Set up error handling for all queues
   */
  setupErrorHandling() {
    Object.entries(this.queues).forEach(([name, queue]) => {
      queue.on('error', error => {
        console.error(`Queue ${name} error:`, error);
      });

      queue.on('failed', (job, error) => {
        console.error(`Job ${job.id} in queue ${name} failed:`, error);
      });

      queue.on('stalled', job => {
        console.warn(`Job ${job.id} in queue ${name} is stalled`);
      });
    });
  }

  /**
   * Set up metrics collection
   */
  setupMetrics() {
    this.metrics = {
      processing: {},
      completed: {},
      failed: {},
      delayed: {},
      waiting: {}
    };

    // Update metrics every minute
    setInterval(async () => {
      await this.updateAllMetrics();
    }, 60000);
  }

  /**
   * Update metrics for all queues
   */
  async updateAllMetrics() {
    try {
      for (const [name, queue] of Object.entries(this.queues)) {
        const counts = await Promise.all([
          queue.getActiveCount(),
          queue.getCompletedCount(),
          queue.getFailedCount(),
          queue.getDelayedCount(),
          queue.getWaitingCount()
        ]);

        this.metrics.processing[name] = counts[0];
        this.metrics.completed[name] = counts[1];
        this.metrics.failed[name] = counts[2];
        this.metrics.delayed[name] = counts[3];
        this.metrics.waiting[name] = counts[4];
      }
    } catch (error) {
      console.error('Error updating metrics:', error);
    }
  }

  /**
   * Update metrics for a specific job
   */
  async updateJobMetrics(queueName, status) {
    try {
      if (this.metrics[status]) {
        this.metrics[status][queueName] = (this.metrics[status][queueName] || 0) + 1;
      }
    } catch (error) {
      console.error('Error updating job metrics:', error);
    }
  }

  /**
   * Get queue metrics
   */
  getMetrics() {
    return this.metrics;
  }

  /**
   * Get queue status
   */
  async getQueueStatus(queueName) {
    try {
      const queue = this.queues[queueName];
      if (!queue) {
        throw new Error(`Queue not found: ${queueName}`);
      }

      const [
        activeCount,
        completedCount,
        failedCount,
        delayedCount,
        waitingCount
      ] = await Promise.all([
        queue.getActiveCount(),
        queue.getCompletedCount(),
        queue.getFailedCount(),
        queue.getDelayedCount(),
        queue.getWaitingCount()
      ]);

      return {
        active: activeCount,
        completed: completedCount,
        failed: failedCount,
        delayed: delayedCount,
        waiting: waitingCount
      };
    } catch (error) {
      console.error(`Error getting queue status for ${queueName}:`, error);
      throw error;
    }
  }

  /**
   * Clean completed jobs
   */
  async cleanCompletedJobs(queueName, maxAge = 3600000) {
    try {
      const queue = this.queues[queueName];
      if (!queue) {
        throw new Error(`Queue not found: ${queueName}`);
      }

      await queue.clean(maxAge, 'completed');
      console.log(`Cleaned completed jobs older than ${maxAge}ms from queue ${queueName}`);
    } catch (error) {
      console.error(`Error cleaning completed jobs from queue ${queueName}:`, error);
      throw error;
    }
  }

  /**
   * Clean failed jobs
   */
  async cleanFailedJobs(queueName, maxAge = 86400000) {
    try {
      const queue = this.queues[queueName];
      if (!queue) {
        throw new Error(`Queue not found: ${queueName}`);
      }

      await queue.clean(maxAge, 'failed');
      console.log(`Cleaned failed jobs older than ${maxAge}ms from queue ${queueName}`);
    } catch (error) {
      console.error(`Error cleaning failed jobs from queue ${queueName}:`, error);
      throw error;
    }
  }

  /**
   * Pause a queue
   */
  async pauseQueue(queueName) {
    try {
      const queue = this.queues[queueName];
      if (!queue) {
        throw new Error(`Queue not found: ${queueName}`);
      }

      await queue.pause();
      console.log(`Paused queue ${queueName}`);
    } catch (error) {
      console.error(`Error pausing queue ${queueName}:`, error);
      throw error;
    }
  }

  /**
   * Resume a queue
   */
  async resumeQueue(queueName) {
    try {
      const queue = this.queues[queueName];
      if (!queue) {
        throw new Error(`Queue not found: ${queueName}`);
      }

      await queue.resume();
      console.log(`Resumed queue ${queueName}`);
    } catch (error) {
      console.error(`Error resuming queue ${queueName}:`, error);
      throw error;
    }
  }

  /**
   * Graceful shutdown
   */
  async shutdown() {
    try {
      console.log('Shutting down job queues...');
      
      // Close all queues
      await Promise.all(
        Object.values(this.queues).map(queue => queue.close())
      );

      // Close Redis client
      await this.redisClient.quit();

      console.log('Job queues shut down successfully');
    } catch (error) {
      console.error('Error shutting down job queues:', error);
      throw error;
    }
  }
}

// Export singleton instance
module.exports = new JobQueue(); 
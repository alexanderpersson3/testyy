import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import { Storage } from '@google-cloud/storage';
import { ErrorReporting } from '@google-cloud/error-reporting';
import { Logging } from '@google-cloud/logging';
import { MetricServiceClient } from '@google-cloud/monitoring';
import { PubSub } from '@google-cloud/pubsub';
import { CloudTasksClient } from '@google-cloud/tasks';
import winston from 'winston';

// Initialize Secret Manager
const secretManager = new SecretManagerServiceClient();

// Initialize Cloud Storage
const storage = new Storage();

// Initialize Error Reporting
const errors = new ErrorReporting({
  projectId: process.env.GOOGLE_CLOUD_PROJECT,
  reportMode: process.env.NODE_ENV === 'production' ? 'production' : 'never',
  serviceContext: {
    service: 'rezepta-backend',
    version: process.env.npm_package_version || 'test',
  },
});

// Initialize Cloud Logging
const logging = new Logging();
const log = logging.log('rezepta-backend');

// Initialize Cloud Monitoring
const monitoring = new MetricServiceClient();

// Initialize Pub/Sub
const pubsub = new PubSub();

// Initialize Cloud Tasks
const cloudTasks = new CloudTasksClient();

// Configure winston logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(winston.format.colorize(), winston.format.simple()),
    }),
  ],
});

// Add file transport in production
if (process.env.NODE_ENV === 'production') {
  logger.add(
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    })
  );
  logger.add(
    new winston.transports.File({
      filename: 'logs/combined.log',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    })
  );
}

// Helper function to get secret
async function getSecret(secretName: string): Promise<string> {
  try {
    const [version] = await secretManager.accessSecretVersion({
      name: `projects/${process.env.GOOGLE_CLOUD_PROJECT}/secrets/${secretName}/versions/latest`,
    });
    return version.payload.data.toString();
  } catch (error) {
    console.error(`Error fetching secret ${secretName}:`, error);
    throw error;
  }
}

// Helper function for structured logging
function createStructuredLog(severity: string, message: string, data: any = {}) {
  const entry = log.entry(
    {
      severity,
      resource: {
        type: 'cloud_run_revision',
        labels: {
          service_name: 'rezepta-backend',
          revision_name: process.env.K_REVISION || 'local',
        },
      },
      ...data,
    },
    message
  );

  return log.write(entry);
}

// Helper function for error reporting
function reportError(error: Error, context: any = {}) {
  if (process.env.NODE_ENV === 'production') {
    errors.report(error, context);
  }
  console.error(error);
}

interface TaskData {
  endpoint: string;
  payload: any;
}

// Helper function for creating a Cloud Task
async function createTask(queueName: string, taskData: TaskData, scheduledTime: number | null = null): Promise<string> {
  const location = process.env.CLOUD_TASKS_LOCATION || 'us-central1';
  const project = process.env.GOOGLE_CLOUD_PROJECT;
  const serviceAccountEmail = process.env.CLOUD_TASKS_SERVICE_ACCOUNT;

  const parent = cloudTasks.queuePath(project, location, queueName);

  const task: any = {
    httpRequest: {
      httpMethod: 'POST',
      url: `${process.env.API_BASE_URL}/tasks/${taskData.endpoint}`,
      headers: {
        'Content-Type': 'application/json',
      },
      body: Buffer.from(JSON.stringify(taskData.payload)).toString('base64'),
      oidcToken: {
        serviceAccountEmail,
        audience: process.env.API_BASE_URL,
      },
    },
  };

  if (scheduledTime) {
    task.scheduleTime = {
      seconds: scheduledTime / 1000,
    };
  }

  try {
    const [response] = await cloudTasks.createTask({ parent, task });
    return response.name;
  } catch (error) {
    reportError(error, { taskData });
    throw error;
  }
}

// Helper function for publishing to Pub/Sub
async function publishMessage(topicName: string, data: any): Promise<string> {
  try {
    const topic = pubsub.topic(topicName);
    const messageId = await topic.publish(Buffer.from(JSON.stringify(data)));
    return messageId;
  } catch (error) {
    reportError(error, { topicName, data });
    throw error;
  }
}

interface UploadMetadata {
  contentType?: string;
  [key: string]: any;
}

// Helper function for uploading files to Cloud Storage
async function uploadFile(bucketName: string, filePath: string, fileBuffer: Buffer, metadata: UploadMetadata = {}): Promise<string> {
  try {
    const bucket = storage.bucket(bucketName);
    const file = bucket.file(filePath);

    await file.save(fileBuffer, {
      metadata: {
        contentType: metadata.contentType || 'application/octet-stream',
        ...metadata,
      },
    });

    return file.publicUrl();
  } catch (error) {
    reportError(error, { bucketName, filePath });
    throw error;
  }
}

// Create structured log entry
export const createStructuredLogFunc = (type: string, data: any) => {
  const logEntry = {
    type,
    timestamp: new Date().toISOString(),
    data,
  };

  switch (type) {
    case 'performance_metrics':
      logger.info('Performance Metrics', logEntry);
      break;
    case 'error':
      logger.error('Error', logEntry);
      break;
    case 'security':
      logger.warn('Security Event', logEntry);
      break;
    default:
      logger.info('General Log', logEntry);
  }

  return logEntry;
};

// Export logger instance
export default logger;

// Export cloud services and helper functions
export {
  secretManager,
  storage,
  errors,
  logging,
  monitoring,
  pubsub,
  cloudTasks,
  getSecret,
  createStructuredLog,
  reportError,
  createTask,
  publishMessage,
  uploadFile,
};
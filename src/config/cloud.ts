import { Logging } from '@google-cloud/logging';

// Initialize the logging client
const logging = new Logging({
  projectId: process.env.GOOGLE_CLOUD_PROJECT,
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS
});

// Get the log name from environment or use default
const logName = process.env.CLOUD_LOG_NAME || 'rezepta-api';
const log = logging.log(logName);

interface StructuredLog {
  severity?: 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';
  [key: string]: any;
}

/**
 * Creates a structured log entry in Google Cloud Logging
 * @param event The event name or type
 * @param data The data to log
 * @param severity The severity level of the log
 */
export async function createStructuredLog(
  event: string,
  data: any,
  severity: StructuredLog['severity'] = 'INFO'
): Promise<void> {
  try {
    const metadata = {
      severity,
      resource: {
        type: 'global',
      },
      labels: {
        event,
        environment: process.env.NODE_ENV || 'development'
      }
    };

    const entry = log.entry(metadata, {
      event,
      timestamp: new Date().toISOString(),
      ...data
    });

    if (process.env.NODE_ENV === 'production') {
      await log.write(entry);
    } else {
      // In development, just console.log
      console.log(`[${severity}] ${event}:`, data);
    }
  } catch (error) {
    console.error('Error writing to Cloud Logging:', error);
    // Fallback to console in case of error
    console.log(`[${severity}] ${event}:`, data);
  }
} 
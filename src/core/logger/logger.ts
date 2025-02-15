type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogMetadata {
  [key: string]: any;
}

export class Logger {
  constructor(private context: string) {}

  private log(level: LogLevel, message: string, metadata: LogMetadata = {}): void {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      context: this.context,
      message,
      ...metadata
    };

    // In production, you might want to use a proper logging service
    if (process.env.NODE_ENV === 'production') {
      // TODO: Implement production logging (e.g., to CloudWatch, ELK, etc.)
      console.log(JSON.stringify(logEntry));
    } else {
      const color = {
        debug: '\x1b[34m', // blue
        info: '\x1b[32m',  // green
        warn: '\x1b[33m',  // yellow
        error: '\x1b[31m'  // red
      }[level];
      
      console.log(`${color}[${timestamp}] ${level.toUpperCase()} [${this.context}] ${message}\x1b[0m`, 
        Object.keys(metadata).length ? metadata : '');
    }
  }

  debug(message: string, metadata?: LogMetadata): void {
    this.log('debug', message, metadata);
  }

  info(message: string, metadata?: LogMetadata): void {
    this.log('info', message, metadata);
  }

  warn(message: string, metadata?: LogMetadata): void {
    this.log('warn', message, metadata);
  }

  error(message: string, metadata?: LogMetadata): void {
    this.log('error', message, metadata);
  }
} 
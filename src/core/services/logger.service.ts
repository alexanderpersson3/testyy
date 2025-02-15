import winston from 'winston';
import path from 'path';

export interface LoggerConfig {
  level: string;
  format: string;
  directory: string;
}

/**
 * Centralized logging service
 */
export class LoggerService {
  private logger: winston.Logger;

  constructor(config: LoggerConfig) {
    const { level, format, directory } = config;

    // Create logs directory if it doesn't exist
    const logDir = path.resolve(process.cwd(), directory);

    // Define log format
    const logFormat = winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      format === 'json' 
        ? winston.format.json()
        : winston.format.simple()
    );

    // Create Winston logger instance
    this.logger = winston.createLogger({
      level: level || 'info',
      format: logFormat,
      transports: [
        // Console transport
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          )
        }),
        // File transport for errors
        new winston.transports.File({
          filename: path.join(logDir, 'error.log'),
          level: 'error'
        }),
        // File transport for all logs
        new winston.transports.File({
          filename: path.join(logDir, 'combined.log')
        })
      ]
    });
  }

  /**
   * Log info level message
   */
  public info(message: string, meta?: Record<string, unknown>): void {
    this.logger.info(message, meta);
  }

  /**
   * Log error level message
   */
  public error(message: string, meta?: Record<string, unknown>): void {
    this.logger.error(message, meta);
  }

  /**
   * Log warning level message
   */
  public warn(message: string, meta?: Record<string, unknown>): void {
    this.logger.warn(message, meta);
  }

  /**
   * Log debug level message
   */
  public debug(message: string, meta?: Record<string, unknown>): void {
    this.logger.debug(message, meta);
  }

  /**
   * Log verbose level message
   */
  public verbose(message: string, meta?: Record<string, unknown>): void {
    this.logger.verbose(message, meta);
  }

  /**
   * Get the winston logger instance
   */
  public getLogger(): winston.Logger {
    return this.logger;
  }
} 
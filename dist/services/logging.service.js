import winston from 'winston';
// Define log levels
const levels = {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    debug: 4,
};
// Define log colors
const colors = {
    error: 'red',
    warn: 'yellow',
    info: 'green',
    http: 'magenta',
    debug: 'blue',
};
// Add colors to winston
winston.addColors(colors);
// Define log format
const format = winston.format.combine(winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }), winston.format.colorize({ all: true }), winston.format.printf(info => `${info.timestamp} ${info.level}: ${info.message}`));
// Define different transports
const transports = [
    // Write all logs with level 'error' and below to 'error.log'
    new winston.transports.File({
        filename: 'logs/error.log',
        level: 'error',
    }),
    // Write all logs with level 'info' and below to 'combined.log'
    new winston.transports.File({
        filename: 'logs/combined.log',
    }),
    // Write all logs to console in development
    new winston.transports.Console(),
];
// Create the logger
const Logger = winston.createLogger({
    level: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
    levels,
    format,
    transports,
});
// Create a stream object for Morgan
export const stream = {
    write: (message) => {
        Logger.http(message.trim());
    },
};
export class LoggingService {
    constructor() { }
    static getInstance() {
        if (!LoggingService.instance) {
            LoggingService.instance = new LoggingService();
        }
        return LoggingService.instance;
    }
    // Log error messages
    error(message, error, request) {
        const logMessage = this.formatMessage(message, error, request);
        Logger.error(logMessage);
    }
    // Log warning messages
    warn(message, request) {
        const logMessage = this.formatMessage(message, undefined, request);
        Logger.warn(logMessage);
    }
    // Log info messages
    info(message, request) {
        const logMessage = this.formatMessage(message, undefined, request);
        Logger.info(logMessage);
    }
    // Log debug messages
    debug(message, request) {
        const logMessage = this.formatMessage(message, undefined, request);
        Logger.debug(logMessage);
    }
    // Log HTTP requests
    http(message, request) {
        const logMessage = this.formatMessage(message, undefined, request);
        Logger.http(logMessage);
    }
    // Format log message with additional context
    formatMessage(message, error, request) {
        const context = [message];
        if (error) {
            context.push(`Error: ${error.message}`);
            context.push(`Stack: ${error.stack}`);
        }
        if (request) {
            context.push(`Method: ${request.method}`);
            context.push(`URL: ${request.url}`);
            context.push(`IP: ${request.ip}`);
            if (request.user) {
                context.push(`User: ${request.user.id}`);
            }
        }
        return context.join(' | ');
    }
}
export const logger = LoggingService.getInstance();
//# sourceMappingURL=logging.service.js.map
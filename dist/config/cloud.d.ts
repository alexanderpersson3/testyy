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
export declare function createStructuredLog(event: string, data: any, severity?: StructuredLog['severity']): Promise<void>;
export {};

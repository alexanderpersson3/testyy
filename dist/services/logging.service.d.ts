export declare const stream: {
    write: (message: string) => void;
};
export declare class LoggingService {
    private static instance;
    private constructor();
    static getInstance(): LoggingService;
    error(message: string, error?: Error, request?: Request): void;
    warn(message: string, request?: Request): void;
    info(message: string, request?: Request): void;
    debug(message: string, request?: Request): void;
    http(message: string, request: Request): void;
    private formatMessage;
}
export declare const logger: LoggingService;

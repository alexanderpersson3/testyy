export declare class CronService {
    private static instance;
    private jobs;
    private indexingService;
    private searchService;
    private monitoringService;
    private constructor();
    static getInstance(): CronService;
    /**
     * Initialize cron jobs
     */
    initialize(): void;
    /**
     * Add a new cron job
     */
    private addJob;
    /**
     * Start all jobs
     */
    private startAll;
    /**
     * Stop all jobs
     */
    stopAll(): void;
    /**
     * Parse size string to bytes
     */
    private parseSize;
}

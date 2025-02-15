import { CronJob } from 'cron';
import { ProductIndexingService } from '../search/product-indexing.service.js';
import { ElasticsearchService } from '../search/elasticsearch.service.js';
import { MonitoringService } from '../monitoring.service.js';
import logger from '../../utils/logger.js';
export class CronService {
    constructor() {
        this.jobs = new Map();
        this.indexingService = ProductIndexingService.getInstance();
        this.searchService = ElasticsearchService.getInstance();
        this.monitoringService = MonitoringService.getInstance();
    }
    static getInstance() {
        if (!CronService.instance) {
            CronService.instance = new CronService();
        }
        return CronService.instance;
    }
    /**
     * Initialize cron jobs
     */
    initialize() {
        // Reindex products daily at 2 AM
        this.addJob('reindex-products', '0 2 * * *', async () => {
            try {
                logger.info('Starting scheduled product reindexing...');
                await this.indexingService.reindexAll();
                logger.info('Scheduled product reindexing completed successfully');
            }
            catch (error) {
                logger.error('Scheduled product reindexing failed:', error);
                this.monitoringService.recordError('reindex-products', error);
            }
        });
        // Check index health every 5 minutes
        this.addJob('check-index-health', '*/5 * * * *', async () => {
            try {
                const health = await this.searchService.checkHealth();
                logger.info('Index health check:', health);
                // Record metrics
                this.monitoringService.recordMetric('index.document_count', health.documentCount);
                this.monitoringService.recordMetric('index.size_bytes', this.parseSize(health.indexSize));
                // Alert on issues
                if (health.status !== 'green') {
                    logger.warn(`Index health status is ${health.status}`);
                    this.monitoringService.recordEvent('index-health-warning', {
                        status: health.status,
                        documentCount: health.documentCount,
                        indexSize: health.indexSize,
                    });
                }
            }
            catch (error) {
                logger.error('Index health check failed:', error);
                this.monitoringService.recordError('check-index-health', error);
            }
        });
        // Start all jobs
        this.startAll();
    }
    /**
     * Add a new cron job
     */
    addJob(name, schedule, task) {
        const job = new CronJob(schedule, async () => {
            try {
                await task();
            }
            catch (error) {
                logger.error(`Job ${name} failed:`, error);
            }
        });
        this.jobs.set(name, job);
    }
    /**
     * Start all jobs
     */
    startAll() {
        for (const [name, job] of this.jobs) {
            job.start();
            logger.info(`Started cron job: ${name}`);
        }
    }
    /**
     * Stop all jobs
     */
    stopAll() {
        for (const [name, job] of this.jobs) {
            job.stop();
            logger.info(`Stopped cron job: ${name}`);
        }
    }
    /**
     * Parse size string to bytes
     */
    parseSize(sizeStr) {
        const units = {
            b: 1,
            kb: 1024,
            mb: 1024 * 1024,
            gb: 1024 * 1024 * 1024,
            tb: 1024 * 1024 * 1024 * 1024,
        };
        const match = sizeStr.match(/^(\d+(?:\.\d+)?)\s*([a-z]+)$/i);
        if (!match)
            return 0;
        const size = parseFloat(match[1]);
        const unit = match[2].toLowerCase();
        return size * (units[unit] || 1);
    }
}
CronService.instance = null;
//# sourceMappingURL=cron.service.js.map
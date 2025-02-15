import { ProductIndexingService } from '../services/search/product-indexing.service.js';
import logger from '../utils/logger.js';
const indexingService = ProductIndexingService.getInstance();
async function main() {
    const command = process.argv[2];
    try {
        switch (command) {
            case 'init':
                logger.info('Initializing product index...');
                await indexingService.initializeIndex();
                logger.info('Product index initialized successfully');
                break;
            case 'reindex':
                logger.info('Reindexing all products...');
                await indexingService.reindexAll();
                logger.info('Product reindexing completed successfully');
                break;
            default:
                logger.error('Invalid command. Available commands: init, reindex');
                process.exit(1);
        }
        process.exit(0);
    }
    catch (error) {
        logger.error('Failed to execute command:', error);
        process.exit(1);
    }
}
// Run if not imported as a module
if (require.main === module) {
    main();
}
//# sourceMappingURL=index-products.js.map
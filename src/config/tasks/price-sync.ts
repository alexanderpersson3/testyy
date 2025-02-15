import { schedule } from 'node-cron';
import { PriceSyncService } from '../../features/recipe/services/price-tracking.service';
import { ServiceFactory } from '../../core/di/service.factory';

const logger = ServiceFactory.getLogger();

/**
 * Schedule price sync to run every Monday at 6 AM
 */
schedule('0 6 * * 1', async () => {
  logger.info('Starting scheduled price synchronization...');

  try {
    const priceSyncService = PriceSyncService.getInstance();
    
    // Sync recipe prices
    const syncResult = await priceSyncService.syncRecipePrices();
    logger.info('Price sync completed', {
      totalRecipes: syncResult.totalRecipes,
      updatedPrices: syncResult.updatedPrices,
      errors: syncResult.errors.map(e => ({
        id: e.itemId.toString(),
        error: e.error
      }))
    });

    // Update price alerts
    const alertResult = await priceSyncService.updatePriceAlerts();
    logger.info('Price alert update completed', {
      priceAlerts: alertResult.priceAlerts,
      errors: alertResult.errors.map(e => ({
        id: e.itemId.toString(),
        error: e.error
      }))
    });
  } catch (error) {
    logger.error('Scheduled price sync failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
  }
});

/**
 * Schedule daily price alert checks at 8 AM
 */
schedule('0 8 * * *', async () => {
  logger.info('Starting daily price alert check...');

  try {
    const priceSyncService = PriceSyncService.getInstance();
    const alertResult = await priceSyncService.updatePriceAlerts();
    
    logger.info('Price alert check completed', {
      priceAlerts: alertResult.priceAlerts,
      errors: alertResult.errors.map(e => ({
        id: e.itemId.toString(),
        error: e.error
      }))
    });
  } catch (error) {
    logger.error('Daily price alert check failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
  }
}); 
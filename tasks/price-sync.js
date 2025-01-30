const cron = require('node-cron');
const priceSyncService = require('../services/price-sync-service');

// Schedule price sync to run every Monday at 6 AM
cron.schedule('0 6 * * 1', async () => {
  console.log('Starting scheduled price synchronization...');
  
  try {
    // Sync recipe prices
    const syncResult = await priceSyncService.syncRecipePrices();
    console.log('Price sync result:', syncResult);

    // Update price alerts
    const alertResult = await priceSyncService.updatePriceAlerts();
    console.log('Price alert update result:', alertResult);
  } catch (error) {
    console.error('Scheduled price sync error:', error);
  }
});

// Schedule daily price alert checks at 8 AM
cron.schedule('0 8 * * *', async () => {
  console.log('Starting daily price alert check...');
  
  try {
    const alertResult = await priceSyncService.updatePriceAlerts();
    console.log('Price alert check result:', alertResult);
  } catch (error) {
    console.error('Daily price alert check error:', error);
  }
}); 
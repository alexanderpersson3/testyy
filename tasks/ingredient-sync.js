const cron = require('node-cron');
const ingredientService = require('../services/ingredient-service');

// Schedule ingredient sync to run every Monday at 7 AM (after price sync)
cron.schedule('0 7 * * 1', async () => {
  console.log('Starting scheduled ingredient synchronization...');
  
  try {
    const result = await ingredientService.syncScrapedIngredients();
    console.log('Ingredient sync result:', result);
  } catch (error) {
    console.error('Scheduled ingredient sync error:', error);
  }
}); 
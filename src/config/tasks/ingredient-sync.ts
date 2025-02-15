import { schedule } from 'node-cron';
import { IngredientService } from '../../features/recipe/services/ingredient.service';
import { ServiceFactory } from '../../core/di/service.factory';

const logger = ServiceFactory.getLogger();

/**
 * Schedule ingredient sync to run every Monday at 7 AM (after price sync)
 */
schedule('0 7 * * 1', async () => {
  logger.info('Starting scheduled ingredient synchronization...');

  try {
    const ingredientService = IngredientService.getInstance();
    const result = await ingredientService.syncScrapedIngredients();
    
    logger.info('Ingredient sync completed', {
      totalIngredients: result.totalIngredients,
      updatedIngredients: result.updatedIngredients,
      newIngredients: result.newIngredients,
      errors: result.errors.map(e => ({
        id: e.itemId.toString(),
        error: e.error
      }))
    });
  } catch (error) {
    logger.error('Scheduled ingredient sync failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
  }
}); 
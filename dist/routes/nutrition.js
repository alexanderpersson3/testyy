;
import { ObjectId } from 'mongodb';
;
import { auth } from '../middleware/auth.js';
import { z } from 'zod';
import { rateLimitMiddleware } from '../middleware/rate-limit.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { DatabaseError, ValidationError, NotFoundError } from '../utils/errors.js';
import logger from '../utils/logger.js';
import { NutritionService } from '../services/nutrition.service.js';
const router = Router();
const nutritionService = NutritionService.getInstance();
// Validation schemas
const ingredientSchema = z.object({
    name: z.string().min(1, 'Ingredient name is required'),
    amount: z.number().positive('Amount must be positive'),
    unit: z.string().min(1, 'Unit is required'),
});
const nutritionalInfoSchema = z.object({
    servingSize: z.string().min(1, 'Serving size is required'),
    calories: z.number().nonnegative('Calories must be non-negative'),
    protein: z.number().nonnegative('Protein must be non-negative'),
    carbohydrates: z.number().nonnegative('Carbohydrates must be non-negative'),
    fat: z.number().nonnegative('Fat must be non-negative'),
    fiber: z.number().nonnegative('Fiber must be non-negative'),
    sugar: z.number().nonnegative('Sugar must be non-negative'),
    sodium: z.number().nonnegative('Sodium must be non-negative'),
});
// Calculate nutritional information for ingredients
router.post('/calculate', auth, rateLimitMiddleware.api(), validateRequest(z.object({ ingredients: z.array(ingredientSchema) })), asyncHandler(async (req, res) => {
    if (!req.user) {
        throw new ValidationError('Authentication required');
    }
    try {
        const nutritionalInfo = await nutritionService.calculateNutritionalInfo(req.body.ingredients);
        res.json({ nutritionalInfo });
    }
    catch (error) {
        logger.error('Failed to calculate nutritional info:', error);
        throw new DatabaseError('Failed to calculate nutritional info');
    }
}));
// Update recipe nutritional information
router.put('/recipes/:id', auth, rateLimitMiddleware.api(), validateRequest(z.object({ nutritionalInfo: nutritionalInfoSchema })), asyncHandler(async (req, res) => {
    if (!req.user) {
        throw new ValidationError('Authentication required');
    }
    try {
        await nutritionService.updateRecipeNutrition(new ObjectId(req.params.id), new ObjectId(req.user.id), req.body.nutritionalInfo);
        res.json({ success: true });
    }
    catch (error) {
        if (error instanceof Error && error.message === 'Recipe not found or unauthorized') {
            throw new NotFoundError('Recipe not found or unauthorized');
        }
        logger.error('Failed to update recipe nutrition:', error);
        throw new DatabaseError('Failed to update recipe nutrition');
    }
}));
// Get meal plan nutritional information
router.get('/meal-plans/:id', auth, rateLimitMiddleware.api(), asyncHandler(async (req, res) => {
    if (!req.user) {
        throw new ValidationError('Authentication required');
    }
    try {
        const nutrition = await nutritionService.getMealPlanNutrition(new ObjectId(req.params.id), new ObjectId(req.user.id));
        res.json(nutrition);
    }
    catch (error) {
        if (error instanceof Error && error.message === 'Meal plan not found or unauthorized') {
            throw new NotFoundError('Meal plan not found or unauthorized');
        }
        logger.error('Failed to get meal plan nutrition:', error);
        throw new DatabaseError('Failed to get meal plan nutrition');
    }
}));
export default router;
//# sourceMappingURL=nutrition.js.map
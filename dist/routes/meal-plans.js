;
import { ObjectId } from 'mongodb';
;
import { auth } from '../middleware/auth.js';
import { z } from 'zod';
import { rateLimitMiddleware } from '../middleware/rate-limit.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { DatabaseError, ValidationError, NotFoundError } from '../utils/errors.js';
import logger from '../utils/logger.js';
import { DatabaseService } from '../db/database.service.js';
import { MealPlanService } from '../services/meal-plan.service.js';
const router = Router();
const dbService = DatabaseService.getInstance();
const mealPlanService = MealPlanService.getInstance();
// Validation schemas
const mealSchema = z.object({
    recipeId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid recipe ID'),
    servings: z.number().int().positive('Servings must be a positive integer'),
    notes: z.string().optional(),
    date: z.string().datetime({ offset: true }),
    mealType: z.enum(['breakfast', 'lunch', 'dinner', 'snack']),
});
const mealPlanSchema = z.object({
    name: z.string().min(1, 'Name is required'),
    description: z.string().optional(),
    startDate: z.string().datetime({ offset: true }),
    endDate: z.string().datetime({ offset: true }),
    meals: z.array(mealSchema),
    visibility: z.enum(['public', 'private', 'followers']).optional().default('private'),
});
// Create meal plan
router.post('/', auth, rateLimitMiddleware.api(), validateRequest(mealPlanSchema), asyncHandler(async (req, res) => {
    if (!req.user) {
        throw new ValidationError('Authentication required');
    }
    try {
        const mealPlanId = await mealPlanService.createPlan(req.user.id, req.body);
        res.status(201).json({ success: true, mealPlanId });
    }
    catch (error) {
        logger.error('Failed to create meal plan:', error);
        throw new DatabaseError('Failed to create meal plan');
    }
}));
// Get user's meal plans
router.get('/', auth, rateLimitMiddleware.api(), asyncHandler(async (req, res) => {
    if (!req.user) {
        throw new ValidationError('Authentication required');
    }
    try {
        const mealPlans = await mealPlanService.getPlan(req.user.id);
        res.json(mealPlans);
    }
    catch (error) {
        logger.error('Failed to get meal plans:', error);
        throw new DatabaseError('Failed to get meal plans');
    }
}));
// Get meal plan by ID
router.get('/:id', auth, rateLimitMiddleware.api(), asyncHandler(async (req, res) => {
    if (!req.user) {
        throw new ValidationError('Authentication required');
    }
    try {
        const mealPlan = await mealPlanService.getPlan(req.params.id);
        if (!mealPlan) {
            throw new NotFoundError('Meal plan not found');
        }
        // Check authorization
        if (mealPlan.userId.toString() !== req.user.id) {
            throw new ValidationError('Not authorized to view this meal plan');
        }
        res.json(mealPlan);
    }
    catch (error) {
        if (error instanceof NotFoundError || error instanceof ValidationError) {
            throw error;
        }
        logger.error('Failed to get meal plan:', error);
        throw new DatabaseError('Failed to get meal plan');
    }
}));
// Update meal plan
router.patch('/:id', auth, rateLimitMiddleware.api(), validateRequest(mealPlanSchema.partial()), asyncHandler(async (req, res) => {
    if (!req.user) {
        throw new ValidationError('Authentication required');
    }
    try {
        await mealPlanService.updatePlan(req.params.id, req.user.id, req.body);
        const updatedPlan = await mealPlanService.getPlan(req.params.id);
        if (!updatedPlan) {
            throw new NotFoundError('Meal plan not found');
        }
        res.json(updatedPlan);
    }
    catch (error) {
        if (error instanceof NotFoundError) {
            throw error;
        }
        logger.error('Failed to update meal plan:', error);
        throw new DatabaseError('Failed to update meal plan');
    }
}));
// Delete meal plan
router.delete('/:id', auth, rateLimitMiddleware.api(), asyncHandler(async (req, res) => {
    if (!req.user) {
        throw new ValidationError('Authentication required');
    }
    try {
        const plan = await mealPlanService.getPlan(req.params.id);
        if (!plan) {
            throw new NotFoundError('Meal plan not found');
        }
        if (plan.userId.toString() !== req.user.id) {
            throw new ValidationError('Not authorized to delete this meal plan');
        }
        await mealPlanService.updatePlan(req.params.id, req.user.id, { status: 'archived' });
        res.json({ success: true });
    }
    catch (error) {
        if (error instanceof NotFoundError || error instanceof ValidationError) {
            throw error;
        }
        logger.error('Failed to delete meal plan:', error);
        throw new DatabaseError('Failed to delete meal plan');
    }
}));
export default router;
//# sourceMappingURL=meal-plans.js.map
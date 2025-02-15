;
import { z } from 'zod';
import { auth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { MealPlanningService } from '../services/meal-planning.service.js';
import { handleError } from '../utils/errors.js';
const router = Router();
const mealPlanningService = MealPlanningService.getInstance();
// Validation schemas
const createMealPlanSchema = z.object({
    name: z.string().min(1).max(100),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    mealTimes: z
        .array(z.object({
        name: z.string().min(1),
        time: z.string().regex(/^\d{2}:\d{2}$/),
        order: z.number().int().min(0),
    }))
        .optional(),
});
const addMealSchema = z.object({
    recipeId: z.string().regex(/^[0-9a-fA-F]{24}$/),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    mealTimeId: z.string().regex(/^[0-9a-fA-F]{24}$/),
    servings: z.number().int().min(1).optional(),
    notes: z.string().max(500).optional(),
});
const generateShoppingListSchema = z.object({
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});
const shareMealPlanSchema = z.object({
    userIds: z.array(z.string().regex(/^[0-9a-fA-F]{24}$/)),
});
// Routes
router.post('/', auth, validate(createMealPlanSchema), async (req, res) => {
    try {
        const mealPlan = await mealPlanningService.createMealPlan(req.user.id, req.body);
        res.status(201).json(mealPlan);
    }
    catch (error) {
        handleError(error instanceof Error ? error : new Error('Unknown error'), res);
    }
});
router.get('/', auth, async (req, res) => {
    try {
        const mealPlans = await mealPlanningService.getMealPlans(req.user.id);
        res.json(mealPlans);
    }
    catch (error) {
        handleError(error instanceof Error ? error : new Error('Unknown error'), res);
    }
});
router.get('/:planId', auth, async (req, res) => {
    try {
        const mealPlan = await mealPlanningService.getMealPlan(req.user.id, req.params.planId);
        if (!mealPlan) {
            return res.status(404).json({ error: 'Meal plan not found' });
        }
        res.json(mealPlan);
    }
    catch (error) {
        handleError(error instanceof Error ? error : new Error('Unknown error'), res);
    }
});
router.post('/:planId/meals', auth, validate(addMealSchema), async (req, res) => {
    try {
        const mealPlan = await mealPlanningService.addMeal(req.user.id, req.params.planId, req.body);
        res.status(201).json(mealPlan);
    }
    catch (error) {
        handleError(error instanceof Error ? error : new Error('Unknown error'), res);
    }
});
router.post('/:planId/shopping-list', auth, validate(generateShoppingListSchema), async (req, res) => {
    try {
        const shoppingListId = await mealPlanningService.generateShoppingList(req.user.id, req.params.planId, req.body.startDate, req.body.endDate);
        res.json({ shoppingListId });
    }
    catch (error) {
        handleError(error instanceof Error ? error : new Error('Unknown error'), res);
    }
});
router.post('/:planId/share', auth, validate(shareMealPlanSchema), async (req, res) => {
    try {
        await mealPlanningService.shareMealPlan(req.user.id, req.params.planId, req.body.userIds);
        res.status(204).send();
    }
    catch (error) {
        handleError(error instanceof Error ? error : new Error('Unknown error'), res);
    }
});
export default router;
//# sourceMappingURL=meal-planning.js.map
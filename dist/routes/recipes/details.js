;
import { ObjectId } from 'mongodb';
;
import { auth } from '../../middleware/auth.js';
import { z } from 'zod';
import { rateLimitMiddleware } from '../../middleware/rate-limit.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { DatabaseError, ValidationError, NotFoundError, ForbiddenError } from '../../utils/errors.js';
import logger from '../../utils/logger.js';
import { DatabaseService } from '../../db/database.service.js';
import { IngredientService } from '../../services/ingredient.service.js';
import { SocialService } from '../../services/social.service.js';
const router = Router();
const dbService = DatabaseService.getInstance();
const recipeService = RecipeService.getInstance();
const ingredientService = IngredientService.getInstance();
const socialService = SocialService.getInstance(dbService);
// Validation schemas
const temperatureSchema = z.object({
    value: z.number().min(-50).max(500),
    unit: z.enum(['C', 'F']),
});
const ingredientSchema = z.object({
    name: z.string().min(1, 'Ingredient name is required'),
    amount: z.number().positive('Amount must be positive'),
    unit: z.string().min(1, 'Unit is required'),
    notes: z.string().optional(),
    isOptional: z.boolean().optional(),
    substitutes: z.array(z.string()).optional(),
});
const instructionSchema = z.object({
    text: z.string().min(1, 'Instruction text is required'),
    duration: z.number().int().nonnegative().optional(),
    temperature: temperatureSchema.optional(),
    notes: z.string().optional(),
    warningLevel: z.enum(['none', 'notice', 'warning', 'critical']).optional(),
});
const recipeSchema = z.object({
    title: z.string().min(1, 'Title is required').max(200, 'Title is too long'),
    description: z.string().max(2000, 'Description is too long'),
    ingredients: z.array(ingredientSchema).min(1, 'At least one ingredient is required'),
    instructions: z.array(instructionSchema).min(1, 'At least one instruction is required'),
    servings: z.number().int().positive('Servings must be a positive integer'),
    prepTime: z.number().int().nonnegative('Prep time cannot be negative'),
    cookTime: z.number().int().nonnegative('Cook time cannot be negative'),
    difficulty: z.enum(['easy', 'medium', 'hard']),
    cuisine: z.string().min(1, 'Cuisine is required'),
    tags: z.array(z.string()),
    visibility: z.enum(['public', 'private', 'followers']).optional().default('public'),
    source: z.object({
        type: z.enum(['user', 'website', 'book', 'other']),
        url: z.string().url().optional(),
        name: z.string().optional(),
    }).optional(),
    notes: z.string().optional(),
    equipment: z.array(z.string()).optional(),
    nutrition: z.object({
        calories: z.number().optional(),
        protein: z.number().optional(),
        carbohydrates: z.number().optional(),
        fat: z.number().optional(),
        fiber: z.number().optional(),
    }).optional(),
});
// Get recipe details with ingredients
router.get('/:id/details', rateLimitMiddleware.api(), asyncHandler(async (req, res) => {
    try {
        const recipe = await recipeService.getRecipe(new ObjectId(req.params.id));
        if (!recipe) {
            throw new NotFoundError('Recipe not found');
        }
        // Check recipe visibility
        if (recipe.visibility === 'private') {
            if (!req.user || !recipe.author || recipe.author._id.toString() !== req.user.id) {
                throw new ForbiddenError('Access denied');
            }
        }
        else if (recipe.visibility === 'followers') {
            if (!req.user) {
                throw new ForbiddenError('Authentication required');
            }
            const isAuthor = recipe.author && recipe.author._id.toString() === req.user.id;
            if (!isAuthor && recipe.author) {
                const isFollowing = await socialService.isFollowing(new ObjectId(req.user.id), recipe.author._id);
                if (!isFollowing) {
                    throw new ForbiddenError('Must be following the author to view this recipe');
                }
            }
        }
        // Get ingredient details
        const ingredients = await Promise.all(recipe.ingredients.map(async (ingredient) => {
            const details = await ingredientService.getIngredient(ingredient.name);
            return {
                ...ingredient,
                details: details || null,
            };
        }));
        // Increment view count
        await dbService.getDb().collection('recipes').updateOne({ _id: recipe._id }, {
            $inc: { 'stats.viewCount': 1 },
            $set: { updatedAt: new Date() }
        });
        res.json({
            ...recipe,
            ingredients,
            stats: {
                ...recipe.stats,
                viewCount: (recipe.stats?.viewCount || 0) + 1
            }
        });
    }
    catch (error) {
        if (error instanceof NotFoundError || error instanceof ForbiddenError) {
            throw error;
        }
        logger.error('Failed to get recipe details:', error);
        throw new DatabaseError('Failed to get recipe details');
    }
}));
// Update recipe details
router.patch('/:id/details', auth, rateLimitMiddleware.api(), validateRequest(recipeSchema.partial()), asyncHandler(async (req, res) => {
    if (!req.user) {
        throw new ValidationError('Authentication required');
    }
    try {
        const recipe = await recipeService.getRecipe(new ObjectId(req.params.id));
        if (!recipe) {
            throw new NotFoundError('Recipe not found');
        }
        // Check ownership
        if (!recipe.author || recipe.author._id.toString() !== req.user.id) {
            throw new ForbiddenError('Not authorized to update this recipe');
        }
        // Calculate total time if prep or cook time is being updated
        const totalTime = req.body.prepTime !== undefined || req.body.cookTime !== undefined
            ? (req.body.prepTime || recipe.prepTime || 0) + (req.body.cookTime || recipe.cookTime || 0)
            : undefined;
        const updateData = {
            ...req.body,
            ...(totalTime !== undefined ? { totalTime } : {}),
        };
        const updatedRecipe = await recipeService.updateRecipe(new ObjectId(req.params.id), updateData);
        res.json(updatedRecipe);
    }
    catch (error) {
        if (error instanceof NotFoundError || error instanceof ForbiddenError || error instanceof ValidationError) {
            throw error;
        }
        logger.error('Failed to update recipe details:', error);
        throw new DatabaseError('Failed to update recipe details');
    }
}));
export default router;
//# sourceMappingURL=details.js.map
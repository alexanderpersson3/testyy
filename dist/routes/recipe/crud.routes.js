;
import { ObjectId } from 'mongodb';
;
import { auth } from '../../middleware/auth.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { recipeImageUpload } from '../../utils/multer.js';
import { z } from 'zod';
import { SocialService } from '../../services/social.service.js';
import { NotFoundError, ForbiddenError, ValidationError, DatabaseError } from '../../utils/errors.js';
import { DatabaseService } from '../../db/database.service.js';
import { rateLimitMiddleware } from '../../middleware/rate-limit.js';
import logger from '../../utils/logger.js';
const router = Router();
const dbService = DatabaseService.getInstance();
const recipeService = RecipeService.getInstance();
const socialService = SocialService.getInstance(dbService);
// Recipe validation schema
const temperatureSchema = z.object({
    value: z.number(),
    unit: z.enum(['C', 'F']),
});
const ingredientSchema = z.object({
    name: z.string().min(1, 'Ingredient name is required'),
    amount: z.number().positive('Amount must be positive'),
    unit: z.string().min(1, 'Unit is required'),
    notes: z.string().optional(),
});
const instructionSchema = z.object({
    step: z.number().int().positive('Step must be a positive integer'),
    text: z.string().min(1, 'Instruction text is required'),
    duration: z.number().optional(),
    temperature: temperatureSchema.optional(),
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
});
// Search recipes - MUST come before /:id routes
router.get('/search', rateLimitMiddleware.api(), (async (req, res) => {
    try {
        const { limit = '20', sortBy = 'newest', text, cuisine, difficulty, tags, maxPrepTime, minRating } = req.query;
        const searchQuery = {
            limit: Number(limit),
            sortBy: sortBy || 'newest',
            text: text || undefined,
            cuisine: cuisine || undefined,
            difficulty: difficulty || undefined,
            tags: Array.isArray(tags)
                ? tags.map(tag => String(tag))
                : typeof tags === 'string'
                    ? [tags]
                    : undefined,
            maxPrepTime: maxPrepTime ? Number(maxPrepTime) : undefined,
            minRating: minRating ? Number(minRating) : undefined,
        };
        const recipes = await recipeService.searchRecipes(searchQuery);
        res.json(recipes);
    }
    catch (error) {
        logger.error('Failed to search recipes:', error);
        throw new DatabaseError('Failed to search recipes');
    }
}));
// Create recipe
router.post('/', auth, rateLimitMiddleware.api(), recipeImageUpload.single('image'), validateRequest(recipeSchema), (async (req, res) => {
    if (!req.user) {
        throw new ValidationError('Authentication required');
    }
    try {
        const userId = new ObjectId(req.user.id);
        const recipeInput = {
            ...req.body,
            author: {
                _id: userId,
                name: req.user.name,
            },
            images: req.file ? [req.file.path] : [],
        };
        const recipe = await recipeService.createRecipe(recipeInput);
        logger.info(`Recipe created: ${recipe._id} by user ${userId}`);
        res.status(201).json({ recipeId: recipe._id });
    }
    catch (error) {
        if (error instanceof ValidationError) {
            throw error;
        }
        logger.error('Failed to create recipe:', error);
        throw new DatabaseError('Failed to create recipe');
    }
}));
// Get recipe by ID
router.get('/:id', rateLimitMiddleware.api(), (async (req, res) => {
    try {
        const recipeId = new ObjectId(req.params.id);
        const recipe = await recipeService.getRecipe(recipeId);
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
            if (!recipe.author) {
                throw new ForbiddenError('Recipe author not found');
            }
            const isFollowing = await socialService.isFollowing(new ObjectId(req.user.id), recipe.author._id);
            if (!isFollowing && recipe.author._id.toString() !== req.user.id) {
                throw new ForbiddenError('Must be following the author to view this recipe');
            }
        }
        res.json(recipe);
    }
    catch (error) {
        if (error instanceof NotFoundError || error instanceof ForbiddenError) {
            throw error;
        }
        logger.error('Failed to get recipe:', error);
        throw new DatabaseError('Failed to get recipe');
    }
}));
// Update recipe
router.put('/:id', auth, rateLimitMiddleware.api(), recipeImageUpload.single('image'), validateRequest(recipeSchema.partial()), (async (req, res) => {
    if (!req.user) {
        throw new ValidationError('Authentication required');
    }
    try {
        const userId = new ObjectId(req.user.id);
        const recipeId = new ObjectId(req.params.id);
        const recipe = await recipeService.getRecipe(recipeId);
        if (!recipe) {
            throw new NotFoundError('Recipe not found');
        }
        // Verify ownership
        if (!recipe.author || recipe.author._id.toString() !== userId.toString()) {
            throw new ForbiddenError('Unauthorized');
        }
        const update = {
            ...req.body,
            ...(req.file ? { images: [req.file.path] } : {}),
            updatedAt: new Date(),
        };
        const updatedRecipe = await recipeService.updateRecipe(recipeId, update);
        logger.info(`Recipe updated: ${recipeId} by user ${userId}`);
        res.json(updatedRecipe);
    }
    catch (error) {
        if (error instanceof NotFoundError || error instanceof ForbiddenError || error instanceof ValidationError) {
            throw error;
        }
        logger.error('Failed to update recipe:', error);
        throw new DatabaseError('Failed to update recipe');
    }
}));
// Delete recipe
router.delete('/:id', auth, rateLimitMiddleware.api(), (async (req, res) => {
    if (!req.user) {
        throw new ValidationError('Authentication required');
    }
    try {
        const userId = new ObjectId(req.user.id);
        const recipeId = new ObjectId(req.params.id);
        const recipe = await recipeService.getRecipe(recipeId);
        if (!recipe) {
            throw new NotFoundError('Recipe not found');
        }
        // Verify ownership
        if (!recipe.author || recipe.author._id.toString() !== userId.toString()) {
            throw new ForbiddenError('Unauthorized');
        }
        const success = await recipeService.deleteRecipe(recipeId);
        if (!success) {
            throw new DatabaseError('Failed to delete recipe');
        }
        logger.info(`Recipe deleted: ${recipeId} by user ${userId}`);
        res.status(204).send();
    }
    catch (error) {
        if (error instanceof NotFoundError || error instanceof ForbiddenError) {
            throw error;
        }
        logger.error('Failed to delete recipe:', error);
        throw new DatabaseError('Failed to delete recipe');
    }
}));
export default router;
//# sourceMappingURL=crud.routes.js.map
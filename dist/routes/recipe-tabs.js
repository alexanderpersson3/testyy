;
import { ObjectId } from 'mongodb';
;
import { Db } from 'mongodb';
import { auth } from '../middleware/auth.js';
import { z } from 'zod';
import { rateLimitMiddleware } from '../middleware/rate-limit.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { DatabaseError, ValidationError, NotFoundError, ForbiddenError } from '../utils/errors.js';
import logger from '../utils/logger.js';
import { DatabaseService } from '../db/database.service.js';
const router = Router();
const dbService = DatabaseService.getInstance();
// Validation schemas
const tabSchema = z.object({
    name: z.string().min(1, 'Name is required').max(100, 'Name is too long'),
    position: z.number().int().min(0, 'Position must be a non-negative integer'),
    content: z.string().optional(),
    isVisible: z.boolean().optional(),
    metadata: z.record(z.any()).optional(),
});
// Get recipe tabs
router.get('/:recipeId/tabs', auth, rateLimitMiddleware.api(), asyncHandler(async (req, res) => {
    try {
        const db = dbService.getDb();
        const tabs = await db
            .collection('recipe_tabs')
            .find({
            recipeId: new ObjectId(req.params.recipeId),
            isDeleted: { $ne: true }
        })
            .sort({ position: 1 })
            .toArray();
        res.json(tabs);
    }
    catch (error) {
        logger.error('Failed to get recipe tabs:', error);
        throw new DatabaseError('Failed to get recipe tabs');
    }
}));
// Create recipe tab
router.post('/:recipeId/tabs', auth, rateLimitMiddleware.api(), validateRequest(tabSchema), asyncHandler(async (req, res) => {
    if (!req.user) {
        throw new ValidationError('Authentication required');
    }
    try {
        const db = dbService.getDb();
        // Check if recipe exists and user has access
        const recipe = await db.collection('recipes').findOne({
            _id: new ObjectId(req.params.recipeId)
        });
        if (!recipe) {
            throw new NotFoundError('Recipe not found');
        }
        if (recipe.author._id.toString() !== req.user.id) {
            throw new ForbiddenError('Not authorized to modify this recipe');
        }
        // Get max position for proper ordering
        const maxPositionResult = await db
            .collection('recipe_tabs')
            .find({ recipeId: new ObjectId(req.params.recipeId) })
            .sort({ position: -1 })
            .limit(1)
            .toArray();
        const position = req.body.position ?? (maxPositionResult[0]?.position || 0) + 1;
        const tab = {
            ...req.body,
            recipeId: new ObjectId(req.params.recipeId),
            userId: new ObjectId(req.user.id),
            position,
            isVisible: req.body.isVisible ?? true,
            isDeleted: false,
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        const result = await db.collection('recipe_tabs').insertOne(tab);
        res.status(201).json({ ...tab, _id: result.insertedId });
    }
    catch (error) {
        if (error instanceof NotFoundError || error instanceof ForbiddenError) {
            throw error;
        }
        logger.error('Failed to create recipe tab:', error);
        throw new DatabaseError('Failed to create recipe tab');
    }
}));
// Update recipe tab
router.patch('/:recipeId/tabs/:tabId', auth, rateLimitMiddleware.api(), validateRequest(tabSchema.partial()), asyncHandler(async (req, res) => {
    if (!req.user) {
        throw new ValidationError('Authentication required');
    }
    try {
        const db = dbService.getDb();
        // Check if tab exists and user has access
        const tab = await db.collection('recipe_tabs').findOne({
            _id: new ObjectId(req.params.tabId),
            recipeId: new ObjectId(req.params.recipeId)
        });
        if (!tab) {
            throw new NotFoundError('Tab not found');
        }
        if (tab.userId.toString() !== req.user.id) {
            throw new ForbiddenError('Not authorized to modify this tab');
        }
        // If position is being updated, handle reordering
        if (typeof req.body.position === 'number' && req.body.position !== tab.position) {
            await handleTabReordering(db, new ObjectId(req.params.recipeId), tab.position, req.body.position);
        }
        const result = await db.collection('recipe_tabs').findOneAndUpdate({
            _id: new ObjectId(req.params.tabId),
            recipeId: new ObjectId(req.params.recipeId),
            userId: new ObjectId(req.user.id),
        }, {
            $set: {
                ...req.body,
                updatedAt: new Date(),
            },
        }, { returnDocument: 'after' });
        if (!result.value) {
            throw new NotFoundError('Tab not found or unauthorized');
        }
        res.json(result.value);
    }
    catch (error) {
        if (error instanceof NotFoundError || error instanceof ForbiddenError) {
            throw error;
        }
        logger.error('Failed to update recipe tab:', error);
        throw new DatabaseError('Failed to update recipe tab');
    }
}));
// Delete recipe tab
router.delete('/:recipeId/tabs/:tabId', auth, rateLimitMiddleware.api(), asyncHandler(async (req, res) => {
    if (!req.user) {
        throw new ValidationError('Authentication required');
    }
    try {
        const db = dbService.getDb();
        // Check if tab exists and user has access
        const tab = await db.collection('recipe_tabs').findOne({
            _id: new ObjectId(req.params.tabId),
            recipeId: new ObjectId(req.params.recipeId)
        });
        if (!tab) {
            throw new NotFoundError('Tab not found');
        }
        if (tab.userId.toString() !== req.user.id) {
            throw new ForbiddenError('Not authorized to delete this tab');
        }
        // Soft delete the tab
        const result = await db.collection('recipe_tabs').updateOne({
            _id: new ObjectId(req.params.tabId),
            recipeId: new ObjectId(req.params.recipeId),
            userId: new ObjectId(req.user.id),
        }, {
            $set: {
                isDeleted: true,
                updatedAt: new Date(),
            },
        });
        if (result.modifiedCount === 0) {
            throw new NotFoundError('Tab not found or unauthorized');
        }
        // Reorder remaining tabs
        await db.collection('recipe_tabs').updateMany({
            recipeId: new ObjectId(req.params.recipeId),
            position: { $gt: tab.position },
            isDeleted: { $ne: true }
        }, {
            $inc: { position: -1 }
        });
        res.status(204).send();
    }
    catch (error) {
        if (error instanceof NotFoundError || error instanceof ForbiddenError) {
            throw error;
        }
        logger.error('Failed to delete recipe tab:', error);
        throw new DatabaseError('Failed to delete recipe tab');
    }
}));
// Helper function to handle tab reordering
async function handleTabReordering(db, recipeId, oldPosition, newPosition) {
    if (oldPosition === newPosition)
        return;
    const updateOperation = oldPosition < newPosition
        ? {
            // Moving down: decrement positions of tabs between old and new positions
            $inc: { position: -1 }
        }
        : {
            // Moving up: increment positions of tabs between new and old positions
            $inc: { position: 1 }
        };
    await db.collection('recipe_tabs').updateMany({
        recipeId,
        position: oldPosition < newPosition
            ? { $gt: oldPosition, $lte: newPosition }
            : { $gte: newPosition, $lt: oldPosition },
        isDeleted: { $ne: true }
    }, updateOperation);
}
export default router;
//# sourceMappingURL=recipe-tabs.js.map
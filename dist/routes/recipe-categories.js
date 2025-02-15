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
const router = Router();
const dbService = DatabaseService.getInstance();
// Validation schemas
const categorySchema = z.object({
    name: z.string().min(1, 'Name is required'),
    description: z.string().optional(),
    parentId: z.string().optional(),
    icon: z.string().optional(),
    color: z.string().optional(),
    metadata: z.record(z.any()).optional(),
});
// Get all categories
router.get('/', rateLimitMiddleware.api(), asyncHandler(async (req, res) => {
    try {
        const categories = await dbService.getCollection('recipe_categories')
            .find({
            isDeleted: { $ne: true }
        })
            .sort({ name: 1 })
            .toArray();
        res.json(categories);
    }
    catch (error) {
        logger.error('Failed to get categories:', error);
        throw new DatabaseError('Failed to get categories');
    }
}));
// Create category
router.post('/', auth, rateLimitMiddleware.api(), validateRequest(categorySchema), asyncHandler(async (req, res) => {
    if (!req.user) {
        throw new ValidationError('Authentication required');
    }
    try {
        const category = {
            ...req.body,
            parentId: req.body.parentId ? new ObjectId(req.body.parentId) : undefined,
            createdBy: new ObjectId(req.user.id),
            isDeleted: false,
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        const result = await dbService.getCollection('recipe_categories').insertOne(category);
        res.status(201).json({ ...category, _id: result.insertedId });
    }
    catch (error) {
        logger.error('Failed to create category:', error);
        throw new DatabaseError('Failed to create category');
    }
}));
// Update category
router.patch('/:id', auth, rateLimitMiddleware.api(), validateRequest(categorySchema.partial()), asyncHandler(async (req, res) => {
    if (!req.user) {
        throw new ValidationError('Authentication required');
    }
    try {
        const categoryId = new ObjectId(req.params.id);
        const category = await dbService.getCollection('recipe_categories').findOne({
            _id: categoryId,
            isDeleted: { $ne: true }
        });
        if (!category) {
            throw new NotFoundError('Category not found');
        }
        const updates = {
            ...req.body,
            parentId: req.body.parentId ? new ObjectId(req.body.parentId) : undefined,
            updatedAt: new Date(),
        };
        const result = await dbService.getCollection('recipe_categories').findOneAndUpdate({ _id: categoryId }, { $set: updates }, { returnDocument: 'after' });
        if (!result.value) {
            throw new NotFoundError('Category not found');
        }
        res.json(result.value);
    }
    catch (error) {
        if (error instanceof NotFoundError) {
            throw error;
        }
        logger.error('Failed to update category:', error);
        throw new DatabaseError('Failed to update category');
    }
}));
// Delete category
router.delete('/:id', auth, rateLimitMiddleware.api(), asyncHandler(async (req, res) => {
    if (!req.user) {
        throw new ValidationError('Authentication required');
    }
    try {
        const categoryId = new ObjectId(req.params.id);
        // Check if category exists
        const category = await dbService.getCollection('recipe_categories').findOne({
            _id: categoryId,
            isDeleted: { $ne: true }
        });
        if (!category) {
            throw new NotFoundError('Category not found');
        }
        // Soft delete the category
        await dbService.getCollection('recipe_categories').updateOne({ _id: categoryId }, {
            $set: {
                isDeleted: true,
                updatedAt: new Date(),
                deletedAt: new Date(),
                deletedBy: new ObjectId(req.user.id)
            }
        });
        res.status(204).send();
    }
    catch (error) {
        if (error instanceof NotFoundError) {
            throw error;
        }
        logger.error('Failed to delete category:', error);
        throw new DatabaseError('Failed to delete category');
    }
}));
// Get category by ID
router.get('/:id', rateLimitMiddleware.api(), asyncHandler(async (req, res) => {
    try {
        const category = await dbService.getCollection('recipe_categories').findOne({
            _id: new ObjectId(req.params.id),
            isDeleted: { $ne: true }
        });
        if (!category) {
            throw new NotFoundError('Category not found');
        }
        res.json(category);
    }
    catch (error) {
        if (error instanceof NotFoundError) {
            throw error;
        }
        logger.error('Failed to get category:', error);
        throw new DatabaseError('Failed to get category');
    }
}));
export default router;
//# sourceMappingURL=recipe-categories.js.map
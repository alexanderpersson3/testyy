;
;
import { connectToDatabase } from '../db.js';
import { auth, rateLimitMiddleware } from '../middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { CollaboratorInfo } from '../types/models.js';
import { z } from 'zod';
const router = Router();
// Schema for collection settings
const collectionSettingsSchema = z.object({
    sortBy: z.enum(['name', 'rating', 'difficulty', 'cookingTime', 'created', 'updated', 'popularity', 'custom']).optional(),
    sortDirection: z.enum(['asc', 'desc']).optional(),
    defaultView: z.enum(['grid', 'list', 'detailed']).optional(),
    showNotes: z.boolean().optional(),
    showRatings: z.boolean().optional(),
    showCookingHistory: z.boolean().optional(),
    enableNotifications: z.boolean().optional(),
    autoAddToGroceryList: z.boolean().optional()
});
// Schema for collection creation/update
const collectionSchema = z.object({
    name: z.string().min(1).max(100),
    description: z.string().optional(),
    icon: z.string().optional(),
    color: z.string()
        .optional()
        .refine(val => !val || /^#[0-9A-Fa-f]{6}$/.test(val), {
        message: 'Color must be a valid hex color code',
    }),
    order: z.number().int().min(0).optional()
});
// Helper function to check collection access
async function hasCollectionAccess(collectionId, userId, requiredRole = 'viewer') {
    const collections = getCollection('recipe_collections');
    const collection = await collections.findOne({
        _id: collectionId,
        $or: [
            { userId },
            {
                'collaborators.userId': userId,
                'collaborators.role': {
                    $in: requiredRole === 'editor' ? ['editor'] : ['editor', 'viewer'],
                },
            },
        ],
    });
    return !!collection;
}
// Get all collections for the authenticated user
const getCollections = async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        await connectToDatabase();
        const collections = getCollection('recipe_collections');
        const userCollections = await collections
            .find({ userId: new ObjectId(req.user.id) })
            .toArray();
        res.json(userCollections);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch collections' });
    }
};
// Create a new collection
const createCollection = async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        await connectToDatabase();
        const collections = getCollection('recipe_collections');
        const newCollection = {
            _id: new ObjectId(),
            userId: new ObjectId(req.user.id),
            name: req.body.name,
            description: req.body.description,
            icon: req.body.icon,
            color: req.body.color,
            recipeIds: [],
            isDefault: false,
            order: 0,
            collaborators: [],
            isShared: false,
            createdAt: new Date(),
            updatedAt: new Date()
        };
        const result = await collections.insertOne(newCollection);
        const insertedCollection = await collections.findOne({ _id: result.insertedId });
        if (!insertedCollection) {
            throw new Error('Failed to create collection');
        }
        res.status(201).json(insertedCollection);
    }
    catch (error) {
        console.error('Failed to create collection:', error);
        res.status(500).json({ error: 'Failed to create collection' });
    }
};
// Register routes
router.get('/', auth, rateLimitMiddleware.api, getCollections);
router.post('/', auth, rateLimitMiddleware.api, validateRequest({ body: collectionSchema }), createCollection);
// Update collection
router.patch('/:id', auth, [
    check('name').optional().notEmpty().trim(),
    check('description').optional().trim(),
    check('icon').optional().trim(),
    check('color')
        .optional()
        .trim()
        .matches(/^#[0-9A-Fa-f]{6}$/),
    check('order').optional().isInt({ min: 0 }),
], asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    const collectionId = new ObjectId(req.params.id);
    const collections = getCollection('recipe_collections');
    const updateData = {
        ...req.body,
        updatedAt: new Date(),
    };
    const result = await collections.updateOne({
        _id: collectionId,
        userId: new ObjectId(req.user.id),
        isDefault: false, // Prevent updating default collections
    }, { $set: updateData });
    if (result.matchedCount === 0) {
        return res.status(404).json({ message: 'Collection not found or cannot be modified' });
    }
    res.json({ success: true });
}));
// Delete collection
router.delete('/:id', auth, asyncHandler(async (req, res) => {
    const collectionId = new ObjectId(req.params.id);
    const collections = getCollection('recipe_collections');
    const result = await collections.deleteOne({
        _id: collectionId,
        userId: new ObjectId(req.user.id),
        isDefault: false, // Prevent deleting default collections
    });
    if (result.deletedCount === 0) {
        return res.status(404).json({ message: 'Collection not found or cannot be deleted' });
    }
    res.json({ success: true });
}));
// Add recipe to collection
router.post('/:id/recipes/:recipeId', auth, asyncHandler(async (req, res) => {
    const collectionId = new ObjectId(req.params.id);
    const recipeId = new ObjectId(req.params.recipeId);
    const collections = getCollection('recipe_collections');
    const favoriteRecipes = getCollection('favorite_recipes');
    const recipes = getCollection('recipes');
    // Verify recipe exists and is favorited
    const favorite = await favoriteRecipes.findOne({
        userId: new ObjectId(req.user.id),
        recipeId,
    });
    if (!favorite) {
        return res.status(400).json({ message: 'Recipe must be favorited first' });
    }
    const result = await collections.updateOne({
        _id: collectionId,
        userId: new ObjectId(req.user.id),
    }, {
        $addToSet: { recipeIds: recipeId },
        $set: { updatedAt: new Date() },
    });
    if (result.matchedCount === 0) {
        return res.status(404).json({ message: 'Collection not found' });
    }
    // Get recipe details for activity log
    const recipe = await recipes.findOne({ _id: recipeId });
    // Log activity
    await getCollectionActivityService().logCollectionActivity(collectionId, new ObjectId(req.user.id), 'recipe_added', {
        recipeId,
        recipeTitle: recipe?.title,
    });
    // Send WebSocket notification
    getCollectionWebSocketService().notifyCollectionUpdate({
        type: 'recipe_added',
        collectionId: collectionId.toString(),
        data: { recipeId: recipeId.toString() },
    });
    res.json({ success: true });
}));
// Remove recipe from collection
router.delete('/:id/recipes/:recipeId', auth, asyncHandler(async (req, res) => {
    const collectionId = new ObjectId(req.params.id);
    const recipeId = new ObjectId(req.params.recipeId);
    const collections = getCollection('recipe_collections');
    const result = await collections.updateOne({ _id: collectionId }, {
        $pull: {
            recipeIds: recipeId,
        },
    });
    if (result.matchedCount === 0) {
        return res.status(404).json({ message: 'Collection not found' });
    }
    // Send WebSocket notification
    getCollectionWebSocketService().notifyCollectionUpdate({
        type: 'recipe_removed',
        collectionId: collectionId.toString(),
        data: { recipeId: recipeId.toString() },
    });
    res.json({ success: true });
}));
// Get collection contents with recipe details
router.get('/:id/recipes', auth, asyncHandler(async (req, res) => {
    const collectionId = new ObjectId(req.params.id);
    const collections = getCollection('recipe_collections');
    const collection = await collections
        .aggregate([
        {
            $match: {
                _id: collectionId,
                userId: new ObjectId(req.user.id),
            },
        },
        {
            $lookup: {
                from: 'recipes',
                localField: 'recipeIds',
                foreignField: '_id',
                as: 'recipes',
            },
        },
        {
            $lookup: {
                from: 'favorite_recipes',
                let: { recipeIds: '$recipeIds' },
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $and: [
                                    { $in: ['$recipeId', '$$recipeIds'] },
                                    { $eq: ['$userId', new ObjectId(req.user.id)] },
                                ],
                            },
                        },
                    },
                ],
                as: 'favorites',
            },
        },
    ])
        .toArray();
    if (!collection.length) {
        return res.status(404).json({ message: 'Collection not found' });
    }
    res.json(collection[0]);
}));
// Reorder collections
router.post('/reorder', auth, [
    check('orders').isArray(),
    check('orders.*.id').notEmpty(),
    check('orders.*.order').isInt({ min: 0 }),
], asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    const collections = getCollection('recipe_collections');
    const operations = req.body.orders.map((item) => ({
        updateOne: {
            filter: {
                _id: new ObjectId(item.id),
                userId: new ObjectId(req.user.id),
            },
            update: {
                $set: {
                    order: item.order,
                    updatedAt: new Date(),
                },
            },
        },
    }));
    await collections.bulkWrite(operations);
    res.json({ success: true });
}));
// Share collection with user
router.post('/:id/share', auth, [check('email').isEmail(), check('role').isIn(['viewer', 'editor'])], asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    const collectionId = new ObjectId(req.params.id);
    const collections = getCollection('recipe_collections');
    const users = getCollection('users');
    // Find target user by email
    const targetUser = await users.findOne({ email: req.body.email });
    if (!targetUser) {
        return res.status(404).json({ message: 'User not found' });
    }
    // Verify ownership
    const collection = await collections.findOne({
        _id: collectionId,
        userId: new ObjectId(req.user.id),
    });
    if (!collection) {
        return res.status(404).json({ message: 'Collection not found or you are not the owner' });
    }
    // Check if already shared with user
    if (collection.collaborators?.some(c => c.userId.equals(targetUser._id))) {
        return res.status(400).json({ message: 'Collection already shared with this user' });
    }
    const result = await collections.updateOne({ _id: collectionId }, {
        $push: {
            collaborators: {
                $each: [
                    {
                        userId: targetUser._id,
                        role: req.body.role,
                        addedAt: new Date(),
                    },
                ],
            },
            $set: {
                isShared: true,
                updatedAt: new Date(),
            },
        },
    });
    // Log activity
    await getCollectionActivityService().logCollectionActivity(collectionId, new ObjectId(req.user.id), 'collaborator_added', {
        collaboratorId: targetUser._id,
        collaboratorEmail: targetUser.email,
        role: req.body.role,
    });
    // Send WebSocket notification
    getCollectionWebSocketService().notifyCollectionUpdate({
        type: 'collaborator_added',
        collectionId: collectionId.toString(),
        data: {
            userId: targetUser._id.toString(),
            role: req.body.role,
            email: targetUser.email,
            name: targetUser.name,
        },
    });
    res.json({ success: true });
}));
// Update collaborator role
router.patch('/:id/share/:userId', auth, [check('role').isIn(['viewer', 'editor'])], asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    const db = await connectToDatabase();
    const collectionId = new ObjectId(req.params.id);
    const targetUserId = new ObjectId(req.params.userId);
    const result = await db.collection('recipe_collections').updateOne({
        _id: collectionId,
        userId: new ObjectId(req.user.id),
        'collaborators.userId': targetUserId,
    }, {
        $set: {
            'collaborators.$.role': req.body.role,
            updatedAt: new Date(),
        },
    });
    if (result.matchedCount === 0) {
        return res.status(404).json({ message: 'Collection or collaborator not found' });
    }
    // Send WebSocket notification
    getCollectionWebSocketService().notifyCollectionUpdate({
        type: 'collaborator_updated',
        collectionId: collectionId.toString(),
        data: {
            userId: targetUserId.toString(),
            role: req.body.role,
        },
    });
    res.json({ success: true });
}));
// Remove collaborator
router.delete('/:id/share/:userId', auth, asyncHandler(async (req, res) => {
    const collectionId = new ObjectId(req.params.id);
    const targetUserId = new ObjectId(req.params.userId);
    const collections = getCollection('recipe_collections');
    const result = await collections.updateOne({ _id: collectionId }, {
        $pull: {
            collaborators: {
                userId: { $in: [targetUserId] },
            },
        },
    });
    if (result.matchedCount === 0) {
        return res.status(404).json({ message: 'Collection not found or you are not the owner' });
    }
    // Send WebSocket notification
    getCollectionWebSocketService().notifyCollectionUpdate({
        type: 'collaborator_removed',
        collectionId: collectionId.toString(),
        data: { userId: targetUserId.toString() },
    });
    // Update isShared flag if no more collaborators
    const collection = await collections.findOne({ _id: collectionId });
    if (collection && (!collection.collaborators || collection.collaborators.length === 0)) {
        await collections.updateOne({ _id: collectionId }, { $set: { isShared: false } });
    }
    res.json({ success: true });
}));
// Get collection collaborators
router.get('/:id/collaborators', auth, asyncHandler(async (req, res) => {
    const collectionId = new ObjectId(req.params.id);
    const collections = getCollection('recipe_collections');
    // Verify access
    if (!(await hasCollectionAccess(collectionId, new ObjectId(req.user.id)))) {
        return res.status(404).json({ message: 'Collection not found' });
    }
    const collection = await collections
        .aggregate([
        { $match: { _id: collectionId } },
        {
            $lookup: {
                from: 'users',
                localField: 'collaborators.userId',
                foreignField: '_id',
                as: 'collaboratorDetails',
            },
        },
        {
            $project: {
                collaborators: 1,
                collaboratorDetails: {
                    _id: 1,
                    email: 1,
                    name: 1,
                },
            },
        },
    ])
        .toArray();
    if (!collection.length) {
        return res.status(404).json({ message: 'Collection not found' });
    }
    const { collaborators, collaboratorDetails } = collection[0];
    const enrichedCollaborators = collaborators.map((c) => ({
        ...c,
        user: collaboratorDetails.find((d) => d._id.equals(c.userId)),
    }));
    res.json({ collaborators: enrichedCollaborators });
}));
// Get collection activities
router.get('/:id/activities', auth, [
    check('limit').optional().isInt({ min: 1, max: 100 }),
    check('before').optional().isISO8601(),
    check('type').optional().isArray(),
], asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    const collectionId = new ObjectId(req.params.id);
    // Verify access
    if (!(await hasCollectionAccess(collectionId, new ObjectId(req.user.id)))) {
        return res.status(404).json({ message: 'Collection not found' });
    }
    const type = req.query.type
        ? (Array.isArray(req.query.type)
            ? req.query.type
            : [req.query.type])
        : undefined;
    const activities = await getCollectionActivityService().getCollectionActivities(collectionId, {
        limit: req.query.limit ? parseInt(req.query.limit) : undefined,
        before: req.query.before ? new Date(req.query.before) : undefined,
        type,
    });
    res.json({ activities });
}));
// Get collection statistics
router.get('/:id/stats', auth, asyncHandler(async (req, res) => {
    const collectionId = new ObjectId(req.params.id);
    // Verify access
    if (!(await hasCollectionAccess(collectionId, new ObjectId(req.user.id)))) {
        return res.status(404).json({ message: 'Collection not found' });
    }
    const stats = await getCollectionStatsService().getCollectionStats(collectionId);
    res.json({ stats });
}));
export default router;
//# sourceMappingURL=recipe-collections.js.map
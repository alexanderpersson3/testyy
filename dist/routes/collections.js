import express, { Response } from 'express';
import { ObjectId } from 'mongodb';
;
import { auth } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ValidationError } from '../utils/errors.js';
import { z } from 'zod';
const router = express.Router();
const collectionsService = new CollectionsService();
// Validation schemas
const collectionFilterSchema = z.object({
    visibility: z.array(z.enum(['private', 'shared', 'public'])).optional(),
    tags: z.array(z.string()).optional(),
    hasRecipe: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ObjectId').optional(),
    minRecipes: z.number().int().min(0).optional(),
    maxRecipes: z.number().int().min(0).optional(),
    rating: z.number().min(0).max(5).optional(),
    updatedSince: z.string().datetime().optional(),
    search: z.string().optional(),
});
const createCollectionSchema = z.object({
    name: z.string().min(1, 'Name is required'),
    description: z.string().optional(),
    visibility: z.enum(['private', 'shared', 'public']),
    thumbnail: z.string().url().optional(),
    tags: z.array(z.string()).optional(),
    settings: z.object({
        sortBy: z.enum(['name', 'created', 'updated', 'popularity', 'custom']).optional(),
        sortDirection: z.enum(['asc', 'desc']).optional(),
        defaultView: z.enum(['grid', 'list', 'detailed']).optional(),
        showNotes: z.boolean().optional(),
        showRatings: z.boolean().optional(),
        showCookingHistory: z.boolean().optional(),
        enableNotifications: z.boolean().optional(),
        autoAddToGroceryList: z.boolean().optional(),
    }).optional(),
});
const updateCollectionSchema = createCollectionSchema.partial();
const addRecipeSchema = z.object({
    recipeId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid recipe ID'),
    position: z.number().int().min(0).optional(),
    notes: z.string().optional(),
    tags: z.array(z.string()).optional(),
});
const updateRecipeSchema = z.object({
    position: z.number().int().min(0).optional(),
    notes: z.string().optional(),
    tags: z.array(z.string()).optional(),
    rating: z.number().min(0).max(5).optional(),
    isFavorite: z.boolean().optional(),
});
const collaboratorSchema = z.object({
    userId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid user ID'),
    role: z.enum(['viewer', 'editor', 'admin']),
});
const shareSchema = z.object({
    expiresIn: z.number().int().min(0).optional(),
});
const exportSchema = z.object({
    format: z.enum(['json', 'pdf', 'csv', 'markdown'], {
        errorMap: () => ({ message: 'Valid export format is required' })
    }),
    includeNotes: z.boolean().optional(),
    includeRatings: z.boolean().optional(),
    includeCookingHistory: z.boolean().optional(),
    includeImages: z.boolean().optional(),
    groupByTags: z.boolean().optional(),
});
const importSchema = z.object({
    format: z.enum(['json', 'csv', 'markdown'], {
        errorMap: () => ({ message: 'Valid import format is required' })
    })
});
// Get collections with optional filtering
router.get('/', auth, validateRequest(collectionFilterSchema), asyncHandler(async (req, res) => {
    if (!req.user) {
        throw new ValidationError('Authentication required');
    }
    const collections = await collectionsService.getCollections(req.user.id, req.query);
    res.json(collections);
}));
// Create collection
router.post('/', auth, validateRequest(createCollectionSchema), asyncHandler(async (req, res) => {
    if (!req.user) {
        throw new ValidationError('Authentication required');
    }
    const collection = await collectionsService.createCollection(req.user.id, req.body);
    res.status(201).json(collection);
}));
// Update collection
router.put('/:collectionId', auth, validateRequest(updateCollectionSchema), asyncHandler(async (req, res) => {
    if (!req.user) {
        throw new ValidationError('Authentication required');
    }
    const collection = await collectionsService.updateCollection(req.user.id, req.params.collectionId, req.body);
    res.json(collection);
}));
// Delete collection
router.delete('/:collectionId', auth, asyncHandler(async (req, res) => {
    if (!req.user) {
        throw new ValidationError('Authentication required');
    }
    await collectionsService.deleteCollection(req.user.id, req.params.collectionId);
    res.status(204).send();
}));
// Add recipe to collection
router.post('/:collectionId/recipes', auth, validateRequest(addRecipeSchema), asyncHandler(async (req, res) => {
    if (!req.user) {
        throw new ValidationError('Authentication required');
    }
    const recipe = await collectionsService.addRecipe(req.user.id, req.params.collectionId, req.body);
    res.status(201).json(recipe);
}));
// Update recipe in collection
router.put('/:collectionId/recipes/:recipeId', auth, validateRequest(updateRecipeSchema), asyncHandler(async (req, res) => {
    if (!req.user) {
        throw new ValidationError('Authentication required');
    }
    const recipe = await collectionsService.updateRecipe(req.user.id, req.params.collectionId, req.params.recipeId, req.body);
    res.json(recipe);
}));
// Remove recipe from collection
router.delete('/:collectionId/recipes/:recipeId', auth, asyncHandler(async (req, res) => {
    if (!req.user) {
        throw new ValidationError('Authentication required');
    }
    await collectionsService.removeRecipe(req.user.id, req.params.collectionId, req.params.recipeId);
    res.status(204).send();
}));
// Add collaborator to collection
router.post('/:collectionId/collaborators', auth, validateRequest(collaboratorSchema), asyncHandler(async (req, res) => {
    if (!req.user) {
        throw new ValidationError('Authentication required');
    }
    const collaborator = await collectionsService.addCollaborator(req.user.id, req.params.collectionId, req.body);
    res.status(201).json(collaborator);
}));
// Remove collaborator from collection
router.delete('/:collectionId/collaborators/:collaboratorId', auth, asyncHandler(async (req, res) => {
    if (!req.user) {
        throw new ValidationError('Authentication required');
    }
    await collectionsService.removeCollaborator(req.user.id, req.params.collectionId, req.params.collaboratorId);
    res.status(204).send();
}));
// Share collection
router.post('/:collectionId/share', auth, validateRequest(shareSchema), asyncHandler(async (req, res) => {
    if (!req.user) {
        throw new ValidationError('Authentication required');
    }
    const shareResult = await collectionsService.shareCollection(req.user.id, req.params.collectionId, req.body.expiresIn);
    res.status(201).json(shareResult);
}));
// Export collection
router.post('/:collectionId/export', auth, validateRequest(exportSchema), asyncHandler(async (req, res) => {
    if (!req.user) {
        throw new ValidationError('Authentication required');
    }
    const exportData = await collectionsService.exportCollection(req.user.id, req.params.collectionId, req.body);
    // Set appropriate headers based on format
    switch (req.body.format) {
        case 'json':
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Content-Disposition', `attachment; filename="collection-${req.params.collectionId}.json"`);
            break;
        case 'pdf':
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename="collection-${req.params.collectionId}.pdf"`);
            break;
        case 'csv':
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename="collection-${req.params.collectionId}.csv"`);
            break;
        case 'markdown':
            res.setHeader('Content-Type', 'text/markdown');
            res.setHeader('Content-Disposition', `attachment; filename="collection-${req.params.collectionId}.md"`);
            break;
    }
    res.send(exportData);
}));
// Import collection
router.post('/import', auth, validateRequest(importSchema), asyncHandler(async (req, res) => {
    if (!req.user) {
        throw new ValidationError('Authentication required');
    }
    if (!req.files?.['file']?.[0]) {
        throw new ValidationError('No file uploaded');
    }
    const file = req.files['file'][0];
    const importResult = await collectionsService.importCollection(req.user.id, file.buffer, req.body.format);
    res.status(201).json(importResult);
}));
// Get collection analytics
router.get('/:collectionId/analytics', auth, asyncHandler(async (req, res) => {
    if (!req.user) {
        throw new ValidationError('Authentication required');
    }
    const analytics = await collectionsService.getAnalytics(req.user.id, req.params.collectionId);
    res.json(analytics);
}));
export default router;
//# sourceMappingURL=collections.js.map
;
import { ObjectId } from 'mongodb';
;
import { auth } from '../middleware/auth.js';
import { z } from 'zod';
import { rateLimitMiddleware } from '../middleware/rate-limit.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { DatabaseError, ValidationError, NotFoundError } from '../utils/errors.js';
import logger from '../utils/logger.js';
import { ImportService } from '../services/import.service.js';
import { ImportFormat } from '../types/export.js';
const router = Router();
const importService = ImportService.getInstance();
// Validation schemas
const urlImportSchema = z.object({
    url: z.string().url('Invalid URL format'),
    options: z.object({
        skipDuplicates: z.boolean().optional(),
        updateExisting: z.boolean().optional(),
        defaultPrivacy: z.enum(['public', 'private']).optional(),
        defaultTags: z.array(z.string()).optional(),
    }).optional(),
});
const batchImportSchema = z.object({
    urls: z.array(z.string().url('Invalid URL format')).min(1, 'At least one URL is required'),
    options: z.object({
        skipDuplicates: z.boolean().optional(),
        updateExisting: z.boolean().optional(),
        defaultPrivacy: z.enum(['public', 'private']).optional(),
        defaultTags: z.array(z.string()).optional(),
    }).optional(),
});
// Import recipe from URL
router.post('/url', auth, rateLimitMiddleware.api(), validateRequest(urlImportSchema), asyncHandler(async (req, res) => {
    if (!req.user) {
        throw new ValidationError('Authentication required');
    }
    try {
        const { url, options } = req.body;
        const job = await importService.createImportJob(new ObjectId(req.user.id), 'url', {
            skipDuplicates: options?.skipDuplicates,
            updateExisting: options?.updateExisting,
            defaultPrivacy: options?.defaultPrivacy,
            defaultTags: options?.defaultTags
        }, url);
        res.status(201).json(job);
    }
    catch (error) {
        logger.error('Failed to import recipe:', error);
        if (error instanceof ValidationError) {
            throw error;
        }
        throw new DatabaseError('Failed to import recipe');
    }
}));
// Batch import recipes
router.post('/batch', auth, rateLimitMiddleware.api(), validateRequest(batchImportSchema), asyncHandler(async (req, res) => {
    if (!req.user) {
        throw new ValidationError('Authentication required');
    }
    try {
        const { urls, options } = req.body;
        const job = await importService.createImportJob(new ObjectId(req.user.id), 'url', {
            skipDuplicates: options?.skipDuplicates,
            updateExisting: options?.updateExisting,
            defaultPrivacy: options?.defaultPrivacy,
            defaultTags: options?.defaultTags
        }, urls.join('\n'));
        res.json(job);
    }
    catch (error) {
        logger.error('Failed to batch import recipes:', error);
        throw new DatabaseError('Failed to batch import recipes');
    }
}));
// Get import history
router.get('/history', auth, rateLimitMiddleware.api(), asyncHandler(async (req, res) => {
    if (!req.user) {
        throw new ValidationError('Authentication required');
    }
    try {
        const jobs = await importService.getMappings(new ObjectId(req.user.id));
        res.json(jobs);
    }
    catch (error) {
        logger.error('Failed to get import history:', error);
        throw new DatabaseError('Failed to get import history');
    }
}));
// Delete import history entry
router.delete('/history/:id', auth, rateLimitMiddleware.api(), asyncHandler(async (req, res) => {
    if (!req.user) {
        throw new ValidationError('Authentication required');
    }
    try {
        const result = await importService.deleteMapping(new ObjectId(req.params.id), new ObjectId(req.user.id));
        if (!result) {
            throw new NotFoundError('Import history entry not found');
        }
        res.status(204).send();
    }
    catch (error) {
        if (error instanceof NotFoundError) {
            throw error;
        }
        logger.error('Failed to delete import history entry:', error);
        throw new DatabaseError('Failed to delete import history entry');
    }
}));
// Retry failed import
router.post('/retry/:id', auth, rateLimitMiddleware.api(), asyncHandler(async (req, res) => {
    if (!req.user) {
        throw new ValidationError('Authentication required');
    }
    try {
        const importEntry = await importService.getImportJob(new ObjectId(req.params.id));
        if (!importEntry) {
            throw new NotFoundError('Import history entry not found');
        }
        const job = await importService.createImportJob(new ObjectId(req.user.id), importEntry.format, importEntry.options, importEntry.fileKey);
        res.json(job);
    }
    catch (error) {
        if (error instanceof NotFoundError) {
            throw error;
        }
        logger.error('Failed to retry import:', error);
        throw new DatabaseError('Failed to retry import');
    }
}));
export default router;
//# sourceMappingURL=recipe-import.js.map
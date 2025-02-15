;
import { z } from 'zod';
import multer from 'multer';
import path from 'path';
import { auth } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { CMSService } from '../../services/cms/cms.service.js';
import { handleError } from '../../utils/errors.js';
import { ObjectId } from 'mongodb';
;
const router = Router();
const cmsService = CMSService.getInstance();
// Configure multer for media uploads
const upload = multer({
    dest: path.join(process.cwd(), 'uploads/recipes'),
    limits: {
        fileSize: 50 * 1024 * 1024, // 50MB
    },
    fileFilter: (req, file, callback) => {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'video/mp4'];
        if (allowedTypes.includes(file.mimetype)) {
            callback(null, true);
        }
        else {
            callback(new Error('Invalid file type'), false);
        }
    },
});
// Validation schemas
const recipeSchema = z.object({
    title: z.string().min(1).max(200),
    description: z.string().min(1).max(2000),
    ingredients: z.array(z.object({
        name: z.string().min(1),
        amount: z.number().positive(),
        unit: z.string(),
        notes: z.string().optional(),
    })),
    instructions: z.array(z.object({
        step: z.number().int().positive(),
        text: z.string().min(1),
        image: z.string().optional(),
        timer: z
            .object({
            duration: z.number().positive(),
            unit: z.enum(['minutes', 'hours']),
        })
            .optional(),
    })),
    servings: z.number().int().positive(),
    prepTime: z.number().int().positive(),
    cookTime: z.number().int().positive(),
    difficulty: z.enum(['easy', 'medium', 'hard']),
    cuisine: z.string().optional(),
    tags: z.array(z.string()),
    status: z.enum(['draft', 'published', 'archived']).optional(),
});
const taxonomySchema = z.object({
    name: z.string().min(1).max(100),
    slug: z.string().min(1).max(100),
    type: z.enum(['cuisine', 'dietary', 'occasion', 'category']),
    description: z.string().max(500).optional(),
    parent: z.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
});
// Recipe management routes
router.post('/recipes', auth, upload.array('media'), validate(recipeSchema), async (req, res) => {
    try {
        const recipe = await cmsService.upsertRecipe({
            ...req.body,
            images: req.files
                .filter(file => file.mimetype.startsWith('image/'))
                .map(file => file.path),
            video: req.files
                .find(file => file.mimetype.startsWith('video/'))
                ?.path,
        });
        res.status(201).json(recipe);
    }
    catch (error) {
        handleError(error instanceof Error ? error : new Error('Unknown error'), res);
    }
});
router.patch('/recipes/:id', auth, upload.array('media'), validate(recipeSchema), async (req, res) => {
    try {
        const recipe = await cmsService.upsertRecipe({
            ...req.body,
            _id: new ObjectId(req.params.id),
            images: req.files
                .filter(file => file.mimetype.startsWith('image/'))
                .map(file => file.path),
            video: req.files
                .find(file => file.mimetype.startsWith('video/'))
                ?.path,
        });
        res.json(recipe);
    }
    catch (error) {
        handleError(error instanceof Error ? error : new Error('Unknown error'), res);
    }
});
// Analytics routes
router.get('/recipes/:id/analytics', auth, async (req, res) => {
    try {
        const period = req.query.period || 'week';
        const analytics = await cmsService.getRecipeAnalytics(new ObjectId(req.params.id), period);
        res.json(analytics);
    }
    catch (error) {
        handleError(error instanceof Error ? error : new Error('Unknown error'), res);
    }
});
// Moderation routes
router.post('/recipes/:id/submit', auth, async (req, res) => {
    try {
        await cmsService.submitForModeration(new ObjectId(req.params.id), new ObjectId(req.user.id));
        res.status(204).send();
    }
    catch (error) {
        handleError(error instanceof Error ? error : new Error('Unknown error'), res);
    }
});
router.get('/moderation/queue', auth, async (req, res) => {
    try {
        const status = req.query.status;
        const queue = await cmsService.getModerationQueue(status);
        res.json(queue);
    }
    catch (error) {
        handleError(error instanceof Error ? error : new Error('Unknown error'), res);
    }
});
router.post('/moderation/:id/review', auth, async (req, res) => {
    try {
        const { status, notes } = req.body;
        await cmsService.reviewRecipe(new ObjectId(req.params.id), new ObjectId(req.user.id), status, notes);
        res.status(204).send();
    }
    catch (error) {
        handleError(error instanceof Error ? error : new Error('Unknown error'), res);
    }
});
// Taxonomy routes
router.post('/taxonomy', auth, validate(taxonomySchema), async (req, res) => {
    try {
        const item = await cmsService.upsertTaxonomyItem({
            ...req.body,
            parent: req.body.parent ? new ObjectId(req.body.parent) : undefined,
        });
        res.status(201).json(item);
    }
    catch (error) {
        handleError(error instanceof Error ? error : new Error('Unknown error'), res);
    }
});
router.patch('/taxonomy/:id', auth, validate(taxonomySchema), async (req, res) => {
    try {
        const item = await cmsService.upsertTaxonomyItem({
            ...req.body,
            _id: new ObjectId(req.params.id),
            parent: req.body.parent ? new ObjectId(req.body.parent) : undefined,
        });
        res.json(item);
    }
    catch (error) {
        handleError(error instanceof Error ? error : new Error('Unknown error'), res);
    }
});
router.get('/taxonomy', auth, async (req, res) => {
    try {
        const type = req.query.type;
        const items = await cmsService.getTaxonomyItems(type);
        res.json(items);
    }
    catch (error) {
        handleError(error instanceof Error ? error : new Error('Unknown error'), res);
    }
});
router.delete('/taxonomy/:id', auth, async (req, res) => {
    try {
        await cmsService.deleteTaxonomyItem(new ObjectId(req.params.id));
        res.status(204).send();
    }
    catch (error) {
        handleError(error instanceof Error ? error : new Error('Unknown error'), res);
    }
});
// Recipe version routes
router.get('/recipes/:id/versions', auth, async (req, res) => {
    try {
        const versions = await cmsService.getRecipeVersions(new ObjectId(req.params.id));
        res.json(versions);
    }
    catch (error) {
        handleError(error instanceof Error ? error : new Error('Unknown error'), res);
    }
});
router.post('/recipes/:id/restore/:version', auth, async (req, res) => {
    try {
        const recipe = await cmsService.restoreRecipeVersion(new ObjectId(req.params.id), parseInt(req.params.version, 10));
        res.json(recipe);
    }
    catch (error) {
        handleError(error instanceof Error ? error : new Error('Unknown error'), res);
    }
});
export default router;
//# sourceMappingURL=cms.routes.js.map
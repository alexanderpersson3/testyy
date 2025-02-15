;
import { z } from 'zod';
import { auth } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { ContentModerationService } from '../../services/cms/content-moderation.service.js';
import { handleError } from '../../utils/errors.js';
import { ObjectId } from 'mongodb';
;
const router = Router();
const moderationService = ContentModerationService.getInstance();
// Validation schemas
const moderationRuleSchema = z.object({
    type: z.enum(['keyword', 'regex', 'score']),
    pattern: z.string(),
    score: z.number().min(0).max(100),
    category: z.enum(['profanity', 'spam', 'offensive', 'inappropriate']),
});
const contentSchema = z.object({
    content: z.string().min(1),
});
const recipeContentSchema = z.object({
    title: z.string().min(1),
    description: z.string().min(1),
    instructions: z.array(z.string().min(1)),
});
// Routes
router.get('/rules', auth, async (req, res) => {
    try {
        const rules = await moderationService.getRules();
        res.json(rules);
    }
    catch (error) {
        handleError(error instanceof Error ? error : new Error('Unknown error'), res);
    }
});
router.post('/rules', auth, validate(moderationRuleSchema), async (req, res) => {
    try {
        const rule = await moderationService.addRule(req.body);
        res.status(201).json(rule);
    }
    catch (error) {
        handleError(error instanceof Error ? error : new Error('Unknown error'), res);
    }
});
router.patch('/rules/:id', auth, validate(moderationRuleSchema), async (req, res) => {
    try {
        const rule = await moderationService.updateRule(new ObjectId(req.params.id), req.body);
        res.json(rule);
    }
    catch (error) {
        handleError(error instanceof Error ? error : new Error('Unknown error'), res);
    }
});
router.delete('/rules/:id', auth, async (req, res) => {
    try {
        await moderationService.removeRule(new ObjectId(req.params.id));
        res.status(204).send();
    }
    catch (error) {
        handleError(error instanceof Error ? error : new Error('Unknown error'), res);
    }
});
router.post('/moderate/content', auth, validate(contentSchema), async (req, res) => {
    try {
        const result = await moderationService.moderateContent(req.body.content);
        res.json(result);
    }
    catch (error) {
        handleError(error instanceof Error ? error : new Error('Unknown error'), res);
    }
});
router.post('/moderate/recipe', auth, validate(recipeContentSchema), async (req, res) => {
    try {
        const result = await moderationService.moderateRecipe(req.body);
        res.json(result);
    }
    catch (error) {
        handleError(error instanceof Error ? error : new Error('Unknown error'), res);
    }
});
router.post('/moderate/comment', auth, validate(contentSchema), async (req, res) => {
    try {
        const result = await moderationService.moderateComment(req.body.content);
        res.json(result);
    }
    catch (error) {
        handleError(error instanceof Error ? error : new Error('Unknown error'), res);
    }
});
export default router;
//# sourceMappingURL=moderation.routes.js.map
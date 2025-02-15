import express, { Response } from 'express';
import { ObjectId } from 'mongodb';
;
import { auth } from '../middleware/auth.js';
import { rateLimitMiddleware } from '../middleware/rate-limit.js';
const router = express.Router();
// Get offline recipes
router.get('/', auth, rateLimitMiddleware.api, async (req, res) => {
    try {
        if (!req.user?.id) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const recipes = await getCollection('recipes')
            .find({ authorId: new ObjectId(req.user.id) })
            .toArray();
        res.json(recipes);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch offline recipes' });
    }
});
// Add recipe to offline storage
router.post('/:id', auth, rateLimitMiddleware.api, async (req, res) => {
    try {
        if (!req.user?.id) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const { id } = req.params;
        const recipe = await getCollection('recipes').findOne({ _id: new ObjectId(id) });
        if (!recipe) {
            return res.status(404).json({ error: 'Recipe not found' });
        }
        // Add recipe to user's offline storage
        await getCollection('offline_recipes').insertOne({
            userId: new ObjectId(req.user.id),
            recipeId: new ObjectId(id),
            addedAt: new Date(),
        });
        res.json({ success: true });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to add recipe to offline storage' });
    }
});
// Remove recipe from offline storage
router.delete('/:id', auth, rateLimitMiddleware.api, async (req, res) => {
    try {
        if (!req.user?.id) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const { id } = req.params;
        await getCollection('offline_recipes').deleteOne({
            userId: new ObjectId(req.user.id),
            recipeId: new ObjectId(id),
        });
        res.json({ success: true });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to remove recipe from offline storage' });
    }
});
export default router;
//# sourceMappingURL=offline-routes.js.map
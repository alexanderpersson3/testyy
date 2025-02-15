;
import { ObjectId } from 'mongodb';
;
import { auth } from '../middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { DatabaseError, NotFoundError, AuthError } from '../utils/errors.js';
import logger from '../utils/logger.js';
const router = Router();
// Get favorite recipes
router.get('/', auth, asyncHandler(async (req, res) => {
    if (!req.user?.id) {
        throw new AuthError('Unauthorized');
    }
    const userId = new ObjectId(req.user.id);
    try {
        const favorites = await getCollection('favorite_recipes')
            .find({ userId })
            .sort({ createdAt: -1 })
            .toArray();
        const recipeIds = favorites.map(fav => fav.recipeId);
        const recipes = await getCollection('recipes')
            .find({ _id: { $in: recipeIds } })
            .toArray();
        // Map recipes to include favorite info
        const recipesWithFavoriteInfo = recipes.map(recipe => ({
            ...recipe,
            favorited: true,
            favoritedAt: favorites.find(f => f.recipeId.equals(recipe._id))?.createdAt,
        }));
        res.json(recipesWithFavoriteInfo);
    }
    catch (error) {
        logger.error('Failed to get favorite recipes:', error);
        throw new DatabaseError('Failed to get favorite recipes');
    }
}));
// Add recipe to favorites
router.post('/:recipeId', auth, asyncHandler(async (req, res) => {
    if (!req.user?.id) {
        throw new AuthError('Unauthorized');
    }
    const userId = new ObjectId(req.user.id);
    const recipeId = new ObjectId(req.params.recipeId);
    try {
        // Check if recipe exists
        const recipe = await getCollection('recipes').findOne({ _id: recipeId });
        if (!recipe) {
            throw new NotFoundError('Recipe not found');
        }
        // Check if already favorited
        const existing = await getCollection('favorite_recipes').findOne({
            userId,
            recipeId,
        });
        if (existing) {
            return res.status(409).json({ message: 'Recipe already in favorites' });
        }
        // Add to favorites
        await getCollection('favorite_recipes').insertOne({
            userId,
            recipeId,
            createdAt: new Date(),
        });
        // Update recipe stats
        await getCollection('recipes').updateOne({ _id: recipeId }, { $inc: { 'stats.favoriteCount': 1 } });
        res.status(201).json({ message: 'Recipe added to favorites' });
    }
    catch (error) {
        logger.error('Failed to add recipe to favorites:', error);
        throw new DatabaseError('Failed to add recipe to favorites');
    }
}));
// Remove recipe from favorites
router.delete('/:recipeId', auth, asyncHandler(async (req, res) => {
    if (!req.user?.id) {
        throw new AuthError('Unauthorized');
    }
    const userId = new ObjectId(req.user.id);
    const recipeId = new ObjectId(req.params.recipeId);
    try {
        const result = await getCollection('favorite_recipes').deleteOne({
            userId,
            recipeId,
        });
        if (result.deletedCount === 0) {
            throw new NotFoundError('Recipe not found in favorites');
        }
        // Update recipe stats
        await getCollection('recipes').updateOne({ _id: recipeId }, { $inc: { 'stats.favoriteCount': -1 } });
        res.json({ message: 'Recipe removed from favorites' });
    }
    catch (error) {
        logger.error('Failed to remove recipe from favorites:', error);
        throw new DatabaseError('Failed to remove recipe from favorites');
    }
}));
// Check if recipe is favorited
router.get('/:recipeId/check', auth, asyncHandler(async (req, res) => {
    if (!req.user?.id) {
        throw new AuthError('Unauthorized');
    }
    const userId = new ObjectId(req.user.id);
    const recipeId = new ObjectId(req.params.recipeId);
    try {
        const favorite = await getCollection('favorite_recipes').findOne({
            userId,
            recipeId,
        });
        res.json({ favorited: !!favorite });
    }
    catch (error) {
        logger.error('Failed to check favorite status:', error);
        throw new DatabaseError('Failed to check favorite status');
    }
}));
// Get favorite recipes by tag
router.get('/by-tag/:tag', auth, asyncHandler(async (req, res) => {
    if (!req.user?.id) {
        throw new AuthError('Unauthorized');
    }
    const userId = new ObjectId(req.user.id);
    const tag = req.params.tag;
    try {
        const favorites = await getCollection('favorite_recipes').find({ userId }).toArray();
        const recipeIds = favorites.map(fav => fav.recipeId);
        const recipes = await getCollection('recipes')
            .find({
            _id: { $in: recipeIds },
            tags: tag,
        })
            .toArray();
        const recipesWithFavoriteInfo = recipes.map(recipe => ({
            ...recipe,
            favorited: true,
            favoritedAt: favorites.find(f => f.recipeId.equals(recipe._id))?.createdAt,
        }));
        res.json(recipesWithFavoriteInfo);
    }
    catch (error) {
        logger.error('Failed to get favorite recipes by tag:', error);
        throw new DatabaseError('Failed to get favorite recipes by tag');
    }
}));
// Get most cooked favorite recipes
router.get('/most-cooked', auth, asyncHandler(async (req, res) => {
    if (!req.user?.id) {
        throw new AuthError('Unauthorized');
    }
    const userId = new ObjectId(req.user.id);
    try {
        const favorites = await getCollection('favorite_recipes').find({ userId }).toArray();
        const recipeIds = favorites.map(fav => fav.recipeId);
        const recipes = await getCollection('recipes')
            .find({ _id: { $in: recipeIds } })
            .sort({ 'stats.cookCount': -1 })
            .limit(10)
            .toArray();
        const recipesWithFavoriteInfo = recipes.map(recipe => ({
            ...recipe,
            favorited: true,
            favoritedAt: favorites.find(f => f.recipeId.equals(recipe._id))?.createdAt,
        }));
        res.json(recipesWithFavoriteInfo);
    }
    catch (error) {
        logger.error('Failed to get most cooked favorite recipes:', error);
        throw new DatabaseError('Failed to get most cooked favorite recipes');
    }
}));
export default router;
//# sourceMappingURL=favorite-recipes.js.map
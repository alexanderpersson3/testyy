import { Router } from 'express';
import { ObjectId } from 'mongodb';
import { getDb } from '../../db.js';
import { rateLimiter } from '../../middleware/rate-limit.js';
import IngredientService from '../../services/ingredient-service.js';
const router = Router();
// Get recipe details
router.get('/:recipeId', rateLimiter.api(), async (req, res) => {
    try {
        const db = await getDb();
        const recipeId = new ObjectId(req.params.recipeId);
        const ingredientService = new IngredientService();
        // Get recipe with ingredient details
        const recipe = await db.collection('recipes').aggregate([
            { $match: { _id: recipeId } },
            {
                $lookup: {
                    from: 'ingredients',
                    localField: 'ingredients.ingredientId',
                    foreignField: '_id',
                    as: 'ingredientDetails'
                }
            }
        ]).next();
        if (!recipe) {
            return res.status(404).json({
                success: false,
                message: 'Recipe not found'
            });
        }
        // Get prices for each ingredient
        const ingredientsWithPrices = await Promise.all(recipe.ingredients.map(async (ingredient) => {
            const ingredientDetail = recipe.ingredientDetails.find((detail) => detail._id.toString() === ingredient.ingredientId.toString());
            // Get current prices from database
            const prices = await ingredientService.getIngredientPrices(ingredient.ingredientId.toString());
            // Get store details for each price
            const pricesWithStores = await Promise.all(prices.map(async (price) => {
                const store = await db.collection('stores').findOne({ _id: price.storeId });
                return {
                    ...price,
                    store: {
                        name: store?.name || 'Unknown Store'
                    }
                };
            }));
            // Get best price
            const bestPrice = pricesWithStores.reduce((best, current) => {
                return (!best || current.price < best.price) ? current : best;
            }, pricesWithStores[0] || null);
            return {
                name: ingredient.name,
                amount: ingredient.amount,
                unit: ingredient.unit,
                image: ingredientDetail?.image || null,
                newPrice: bestPrice?.price || null,
                oldPrice: null, // We don't track historical prices in this version
                store: bestPrice?.store.name || null
            };
        }));
        // Update recipe response
        const response = {
            _id: recipe._id,
            ingredients: ingredientsWithPrices
        };
        res.json({
            success: true,
            data: response
        });
    }
    catch (error) {
        console.error('Recipe details error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get recipe details'
        });
    }
});
export default router;
//# sourceMappingURL=details.js.map
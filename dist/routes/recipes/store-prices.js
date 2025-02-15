import express, { Request, Response } from 'express';
import { ObjectId } from 'mongodb';
;
import { auth } from '../../middleware/auth.js';
import { rateLimitMiddleware } from '../../middleware/rate-limit.js';
import { Store } from '../../types/store.js';
import { ScrapedIngredient } from '../../types/ingredient.js';
;
import { z } from 'zod';
import { StoreScraper } from '../../services/store-scraper.js';
import { redis } from '../../lib/redis.js';
import { StorePriceIngredient } from '../../types/recipe.js';
import { IngredientService } from '../../services/ingredient-service.js';
const router = express.Router();
const scraper = StoreScraper.getInstance();
const ingredientService = IngredientService.getInstance();
// Validation schema for the root endpoint
const storePricesSchema = z.object({
    recipeId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid recipe ID'),
    store: z
        .string()
        .optional()
        .refine(val => !val || val.split(',').every(s => ['Willys', 'Ica', 'Coop', 'Matspar'].includes(s)), 'Invalid store name(s)'),
});
// Validation schema for the /:recipeId/prices endpoint
const ingredientPricesSchema = z.object({
    ingredients: z.array(z.string()),
    stores: z.array(z.string()).optional(),
});
// Store logos mapping
const STORE_LOGOS = {
    Willys: 'https://d3bgqh8ib51vrg.cloudfront.net/images/logos/willys.6dbfdb95.svg',
    Ica: 'https://d3bgqh8ib51vrg.cloudfront.net/images/logos/ica.svg',
    Coop: 'https://d3bgqh8ib51vrg.cloudfront.net/images/logos/coop.svg',
    Matspar: 'https://d3bgqh8ib51vrg.cloudfront.net/images/logos/matspar.svg',
};
// Cache TTL
const CACHE_TTL = 3600; // 1 hour
// Get store prices for recipe
router.get('/:id', rateLimitMiddleware.custom({
    windowMs: 60 * 1000, // 1 minute
    max: 30, // 30 requests per minute for fetching
    keyPrefix: 'rl:store-prices:',
}), async (req, res) => {
    try {
        const { id } = req.params;
        // Get recipe with ingredients
        const recipe = await getCollection('recipes').findOne({ _id: new ObjectId(id) });
        if (!recipe) {
            return res.status(404).json({ error: 'Recipe not found' });
        }
        // Get prices for each ingredient
        const ingredientPrices = await Promise.all(recipe.ingredients.map(async (ingredient) => {
            if (!ingredient.ingredientId) {
                throw new Error('Missing ingredient ID');
            }
            const prices = await getCollection('scraped_ingredients')
                .find({
                ingredientId: new ObjectId(ingredient.ingredientId),
                validTo: { $exists: false },
            })
                .toArray();
            // Get store details for each price
            const pricesWithStores = await Promise.all(prices.map(async (price) => {
                const store = await getCollection('stores').findOne({ _id: price.storeId });
                return {
                    ...price,
                    store: {
                        name: store?.name || 'Unknown Store',
                    },
                };
            }));
            return {
                ingredientId: ingredient.ingredientId,
                name: ingredient.name,
                amount: ingredient.amount,
                unit: ingredient.unit,
                prices: pricesWithStores,
            };
        }));
        res.json({
            success: true,
            data: {
                _id: recipe._id,
                ingredients: ingredientPrices,
            },
        });
    }
    catch (error) {
        console.error('Store prices error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get store prices',
        });
    }
});
// Get store prices for recipe by ID
router.get('/', rateLimitMiddleware.custom({
    windowMs: 60 * 1000, // 1 minute
    max: 10, // 10 requests per minute for scraping
    keyPrefix: 'rl:scraping:',
}), validateRequest(storePricesSchema), async (req, res) => {
    try {
        const { recipeId, store } = req.query;
        // Check cache first
        const cacheKey = `store-prices:${recipeId}:${store || 'all'}`;
        const cachedData = await redis.get(cacheKey);
        if (cachedData) {
            return res.json(JSON.parse(cachedData));
        }
        // Get recipe details
        const recipe = await getCollection('recipes').findOne({
            _id: new ObjectId(recipeId),
        });
        if (!recipe) {
            return res.status(404).json({
                success: false,
                message: 'Recipe not found',
            });
        }
        // Parse store filter
        const storeFilter = store ? store.split(',') : ['Willys', 'Ica', 'Coop', 'Matspar'];
        // Get prices for each ingredient
        const ingredientsWithPrices = await Promise.all(recipe.ingredients.map(async (ingredient) => {
            try {
                if (!ingredient.ingredientId) {
                    throw new Error('Missing ingredient ID');
                }
                // Get current prices from database
                const prices = await ingredientService.getIngredientPrices(ingredient.ingredientId.toString());
                // Filter by requested stores
                const filteredPrices = prices.filter(p => storeFilter.includes(p.store.name));
                // If Matspar.se is requested and no price found, scrape it
                if (storeFilter.includes('Matspar') &&
                    !filteredPrices.some(p => p.store.name === 'Matspar')) {
                    const scrapedPrice = await scraper.scrapeMatSparPrice(ingredient.name);
                    if (scrapedPrice) {
                        filteredPrices.push({
                            price: scrapedPrice.price,
                            oldPrice: scrapedPrice.oldPrice,
                            currency: 'SEK',
                            storeId: new ObjectId(),
                            ingredientId: new ObjectId(ingredient.ingredientId),
                            quantity: scrapedPrice.quantity || 1,
                            unit: scrapedPrice.unit || 'st',
                            store: scrapedPrice.store,
                            validFrom: scrapedPrice.validFrom || new Date(),
                            createdAt: scrapedPrice.createdAt || new Date(),
                            updatedAt: scrapedPrice.updatedAt || new Date(),
                        });
                    }
                }
                // Get best price
                const bestPrice = filteredPrices.reduce((best, current) => {
                    return !best || current.price < best.price ? current : best;
                }, filteredPrices[0] || null);
                return {
                    name: ingredient.name,
                    amount: ingredient.amount,
                    unit: ingredient.unit,
                    newPrice: bestPrice?.price || null,
                    oldPrice: bestPrice?.oldPrice || null,
                    store: bestPrice?.store.name || null,
                };
            }
            catch (error) {
                console.error(`Error getting prices for ingredient ${ingredient.name}:`, error);
                return {
                    name: ingredient.name,
                    amount: ingredient.amount,
                    unit: ingredient.unit,
                    newPrice: null,
                    oldPrice: null,
                    store: null,
                };
            }
        }));
        // Calculate totals
        const totalPrice = ingredientsWithPrices.reduce((sum, item) => sum + (item.newPrice || 0), 0);
        const oldTotalPrice = ingredientsWithPrices.reduce((sum, item) => sum + (item.oldPrice || 0), 0);
        const ingredientsFound = ingredientsWithPrices.filter(i => i.newPrice !== null).length;
        const response = {
            success: true,
            data: {
                store: storeFilter.join(','),
                storeLogo: storeFilter.length === 1
                    ? STORE_LOGOS[storeFilter[0]]
                    : null,
                ingredients: ingredientsWithPrices,
                totalPrice,
                oldTotalPrice,
                ingredientsFound,
                totalIngredientsNeeded: recipe.ingredients.length,
            },
        };
        // Cache the response
        await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(response));
        res.json(response);
    }
    catch (error) {
        console.error('Store prices error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get store prices',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined,
        });
    }
});
// Get prices for specific ingredients
router.get('/:recipeId/prices', rateLimitMiddleware.custom({
    windowMs: 60 * 1000, // 1 minute
    max: 10, // 10 requests per minute for scraping
    keyPrefix: 'rl:scraping:',
}), validateRequest(ingredientPricesSchema), async (req, res) => {
    try {
        const { ingredients, stores } = req.query;
        const storeFilter = stores || ['Matspar'];
        const prices = await Promise.all(ingredients.map(async (ingredient) => {
            const price = await scraper.scrapeMatSparPrice(ingredient);
            if (!price) {
                return {
                    name: ingredient,
                    price: null,
                    oldPrice: null,
                    store: null,
                    unit: null,
                    quantity: null,
                };
            }
            return {
                name: ingredient,
                price: price.price,
                oldPrice: price.oldPrice,
                store: price.store.name,
                unit: price.unit,
                quantity: price.quantity,
            };
        }));
        res.json({
            success: true,
            data: prices,
        });
    }
    catch (error) {
        console.error('Price scraping error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to scrape prices',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined,
        });
    }
});
export default router;
//# sourceMappingURL=store-prices.js.map
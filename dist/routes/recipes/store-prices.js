import { Router } from 'express';
import { z } from 'zod';
import { StoreScraper } from '../../services/store-scraper.js';
import { ObjectId } from 'mongodb';
import { getDb } from '../../db.js';
import { validateRequest } from '../../middleware/validation.js';
import { rateLimiter } from '../../middleware/rate-limit.js';
import IngredientService from '../../services/ingredient-service.js';
import { redis } from '../../lib/redis.js';
const router = Router();
const scraper = new StoreScraper();
// Validation schema for the root endpoint
const storePricesSchema = z.object({
    recipeId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid recipe ID'),
    store: z.string().optional().refine((val) => !val || val.split(',').every(s => ['Willys', 'Ica', 'Coop', 'Matspar'].includes(s)), 'Invalid store name(s)')
});
// Validation schema for the /:recipeId/prices endpoint
const ingredientPricesSchema = z.object({
    ingredients: z.array(z.string()),
    stores: z.array(z.string()).optional()
});
// Store logos mapping
const STORE_LOGOS = {
    'Willys': 'https://d3bgqh8ib51vrg.cloudfront.net/images/logos/willys.6dbfdb95.svg',
    'Ica': 'https://d3bgqh8ib51vrg.cloudfront.net/images/logos/ica.svg',
    'Coop': 'https://d3bgqh8ib51vrg.cloudfront.net/images/logos/coop.svg',
    'Matspar': 'https://d3bgqh8ib51vrg.cloudfront.net/images/logos/matspar.svg'
};
// Cache TTL
const CACHE_TTL = 3600; // 1 hour
// Get store prices for recipe
router.get('/', rateLimiter.scraping(), validateRequest({ params: storePricesSchema }), async (req, res) => {
    try {
        const db = await getDb();
        const { recipeId, store } = req.params;
        // Check cache first
        const cacheKey = `store-prices:${recipeId}:${store || 'all'}`;
        const cachedData = await redis.get(cacheKey);
        if (cachedData) {
            return res.json(JSON.parse(cachedData));
        }
        // Get recipe details
        const recipe = await db.collection('recipes').findOne({
            _id: new ObjectId(recipeId)
        });
        if (!recipe) {
            return res.status(404).json({
                success: false,
                message: 'Recipe not found'
            });
        }
        const ingredientService = new IngredientService();
        // Parse store filter
        const storeFilter = store ? store.split(',') : ['Willys', 'Ica', 'Coop', 'Matspar'];
        // Get prices for each ingredient
        const ingredientsWithPrices = await Promise.all(recipe.ingredients.map(async (ingredient) => {
            try {
                // Get current prices from database
                const prices = await ingredientService.getIngredientPrices(ingredient.ingredientId);
                // Filter by requested stores
                const filteredPrices = prices.filter(p => storeFilter.includes(p.store.name));
                // If Matspar.se is requested and no price found, scrape it
                if (storeFilter.includes('Matspar') && !filteredPrices.some(p => p.store.name === 'Matspar')) {
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
                            updatedAt: scrapedPrice.updatedAt || new Date()
                        });
                    }
                }
                // Get best price
                const bestPrice = filteredPrices.reduce((best, current) => {
                    return (!best || current.price < best.price) ? current : best;
                }, filteredPrices[0] || null);
                return {
                    name: ingredient.name,
                    amount: ingredient.amount,
                    unit: ingredient.unit,
                    image: ingredient.image,
                    newPrice: bestPrice?.price || null,
                    oldPrice: bestPrice?.oldPrice || null,
                    store: bestPrice?.store.name || null
                };
            }
            catch (error) {
                console.error(`Error getting prices for ingredient ${ingredient.name}:`, error);
                return {
                    name: ingredient.name,
                    amount: ingredient.amount,
                    unit: ingredient.unit,
                    image: ingredient.image,
                    newPrice: null,
                    oldPrice: null,
                    store: null
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
                storeLogo: storeFilter.length === 1 ? STORE_LOGOS[storeFilter[0]] : null,
                ingredients: ingredientsWithPrices,
                totalPrice,
                oldTotalPrice,
                ingredientsFound,
                totalIngredientsNeeded: recipe.ingredients.length
            }
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
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});
router.get('/:recipeId/prices', rateLimiter.scraping(), validateRequest({ query: ingredientPricesSchema }), async (req, res) => {
    try {
        const { ingredients, stores } = req.query;
        const storeFilter = stores || ['Matspar'];
        const prices = await Promise.all(ingredients.map(async (ingredient) => {
            const price = await scraper.scrapeMatSparPrice(ingredient);
            if (!price) {
                return {
                    name: ingredient,
                    amount: 1,
                    unit: 'st',
                    image: undefined,
                    newPrice: null,
                    oldPrice: null,
                    store: null
                };
            }
            return {
                name: ingredient,
                amount: price.quantity || 1,
                unit: price.unit || 'st',
                image: undefined,
                newPrice: price.price,
                oldPrice: price.oldPrice || null,
                store: price.store.name
            };
        }));
        const filteredPrices = prices.filter((p) => p.store && storeFilter.includes(p.store));
        // If Matspar was requested but no prices found, add empty results
        if (storeFilter.includes('Matspar') && !filteredPrices.some((p) => p.store === 'Matspar')) {
            const matsparIngredients = ingredients.map((ingredient) => ({
                name: ingredient,
                amount: 1,
                unit: 'st',
                image: undefined,
                newPrice: null,
                oldPrice: null,
                store: 'Matspar'
            }));
            filteredPrices.push(...matsparIngredients);
        }
        // Group by store
        const storeGroups = filteredPrices.reduce((acc, price) => {
            if (!price.store)
                return acc;
            const storeName = price.store;
            if (!acc[storeName]) {
                acc[storeName] = [];
            }
            acc[storeName].push(price);
            return acc;
        }, {});
        const result = Object.entries(storeGroups).map(([storeName, storePrices]) => {
            const totalPrice = storePrices.reduce((sum, p) => sum + (p.newPrice || 0), 0);
            const oldTotalPrice = storePrices.reduce((sum, p) => sum + (p.oldPrice || p.newPrice || 0), 0);
            const ingredientsFound = storePrices.filter(p => p.newPrice !== null).length;
            return {
                store: storeName,
                storeLogo: STORE_LOGOS[storeName] || null,
                ingredients: storePrices,
                totalPrice,
                oldTotalPrice,
                ingredientsFound,
                totalIngredientsNeeded: ingredients.length
            };
        });
        res.json(result);
    }
    catch (error) {
        console.error('Error fetching store prices:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch store prices' });
    }
});
export default router;
//# sourceMappingURL=store-prices.js.map
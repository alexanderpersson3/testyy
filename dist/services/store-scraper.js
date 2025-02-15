import { ObjectId } from 'mongodb';
;
import axios from 'axios';
import * as cheerio from 'cheerio';
import { connectToDatabase } from '../db.js';
import { redis } from '../lib/redis.js';
import { StorePriceIngredient } from '../types/recipe.js';
import logger from '../utils/logger.js';
import { Store } from '../types/store.js';
export class StoreScraper {
    constructor() {
        this.CACHE_TTL = 3600; // 1 hour cache duration
        this.storeConfigs = {
            matspar: {
                baseUrl: 'https://www.matspar.se',
                searchEndpoint: '/search',
                selectors: {
                    price: '.product-price',
                    oldPrice: '.product-price-old',
                    name: '.product-name',
                    image: '.product-image img',
                },
            },
        };
    }
    static getInstance() {
        if (!StoreScraper.instance) {
            StoreScraper.instance = new StoreScraper();
        }
        return StoreScraper.instance;
    }
    async scrapeMatSparPrice(productName) {
        try {
            // Check cache first
            const cacheKey = `price:matspar:${productName}`;
            const cachedPrice = await redis.get(cacheKey);
            if (cachedPrice) {
                return JSON.parse(cachedPrice);
            }
            const config = this.storeConfigs.matspar;
            const searchUrl = `${config.baseUrl}${config.searchEndpoint}?q=${encodeURIComponent(productName)}`;
            const response = await axios.get(searchUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (compatible; RecipeApp/1.0; +http://example.com)',
                },
            });
            const $ = cheerio.load(response.data);
            const firstProduct = $(config.selectors.price).first();
            if (!firstProduct.length) {
                return null;
            }
            const price = parseFloat(firstProduct
                .text()
                .replace(/[^0-9,.]/g, '')
                .replace(',', '.'));
            const oldPriceElement = $(config.selectors.oldPrice).first();
            const oldPrice = oldPriceElement.length
                ? parseFloat(oldPriceElement
                    .text()
                    .replace(/[^0-9,.]/g, '')
                    .replace(',', '.'))
                : undefined;
            const scrapedPrice = {
                price,
                oldPrice,
                currency: 'SEK',
                quantity: 1,
                unit: 'st',
                store: {
                    name: 'Matspar',
                    logo: 'https://d3bgqh8ib51vrg.cloudfront.net/images/logos/matspar.svg',
                },
                validFrom: new Date(),
                createdAt: new Date(),
                updatedAt: new Date(),
            };
            // Cache the result
            await redis.setex(cacheKey, this.CACHE_TTL, JSON.stringify(scrapedPrice));
            return scrapedPrice;
        }
        catch (error) {
            logger.error('Error scraping Matspar price:', error);
            return null;
        }
    }
    async getStore(storeId) {
        try {
            await connectToDatabase();
            return getCollection('stores').findOne({ _id: new ObjectId(storeId) });
        }
        catch (error) {
            logger.error('Error getting store:', error);
            throw error;
        }
    }
    /**
     * Scrape prices for a list of ingredients
     */
    async scrapeIngredientPrices(ingredients) {
        try {
            await connectToDatabase();
            // Get all stores that support price scraping
            const stores = await getCollection('stores')
                .find({ supportsScrapedPrices: true })
                .toArray();
            if (!stores.length) {
                throw new Error('No stores available for price scraping');
            }
            // Try to get prices from each store
            const pricePromises = ingredients.map(async (name) => {
                const prices = await Promise.all(stores.map(async (store) => {
                    const price = await this.scrapeMatSparPrice(name);
                    return { store, price };
                }));
                // Get the best price
                const bestPrice = prices
                    .filter(p => p.price !== null)
                    .sort((a, b) => (a.price?.price || 0) - (b.price?.price || 0))[0];
                return {
                    name,
                    amount: 1,
                    unit: 'piece',
                    newPrice: bestPrice?.price?.price || null,
                    oldPrice: bestPrice?.price?.oldPrice || null,
                    store: bestPrice?.store ? bestPrice.store.name : null,
                };
            });
            const scrapedIngredients = await Promise.all(pricePromises);
            // Calculate totals
            const totalPrice = scrapedIngredients.reduce((sum, ing) => sum + (ing.newPrice || 0), 0);
            const oldTotalPrice = scrapedIngredients.reduce((sum, ing) => sum + (ing.oldPrice || 0), 0);
            const ingredientsFound = scrapedIngredients.filter(ing => ing.newPrice !== null).length;
            return {
                success: true,
                data: {
                    store: 'Multiple Stores',
                    storeLogo: null,
                    ingredients: scrapedIngredients,
                    totalPrice,
                    oldTotalPrice,
                    ingredientsFound,
                    totalIngredientsNeeded: ingredients.length,
                },
            };
        }
        catch (error) {
            logger.error('Error scraping ingredient prices:', error);
            throw error;
        }
    }
    /**
     * Get configuration for a specific store
     */
    getStoreConfig(store) {
        const config = this.storeConfigs[store];
        if (!config) {
            throw new Error(`Store configuration not found for: ${store}`);
        }
        return config;
    }
}
//# sourceMappingURL=store-scraper.js.map
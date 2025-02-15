import { connectToDatabase } from '../../db/db.js';
import { logger } from '../logging.service.js';
import { monitoring } from '../monitoring.service.js';
import { cache } from '../cache.service.js';
import { ScraperInterface } from '../base.scraper.js';
import { Store, ScrapedIngredient } from '../../types/ingredient.js';
import countryConfig from '../../config/country.config.js';
export class ScraperManager {
    constructor() {
        this.scrapers = new Map();
        this.stores = new Map();
    }
    static getInstance() {
        if (!ScraperManager.instance) {
            ScraperManager.instance = new ScraperManager();
        }
        return ScraperManager.instance;
    }
    /**
     * Register a scraper for a specific store
     */
    registerScraper(storeId, scraper) {
        this.scrapers.set(storeId, scraper);
    }
    /**
     * Initialize stores from database
     */
    async initializeStores() {
        try {
            const db = await connectToDatabase();
            const stores = await db.collection('stores').find().toArray();
            stores.forEach(store => {
                this.stores.set(store._id.toString(), store);
            });
            logger.info(`Initialized ${stores.length} stores`);
        }
        catch (error) {
            logger.error('Failed to initialize stores', error);
            throw error;
        }
    }
    /**
     * Get prices for ingredients from all relevant stores in a country
     */
    async getPricesForCountry(country, ingredientIds) {
        const countryStores = countryConfig[country]?.stores || [];
        const results = [];
        await Promise.all(countryStores.map(async (storeId) => {
            try {
                const scraper = this.scrapers.get(storeId);
                if (!scraper) {
                    logger.warn(`No scraper found for store ${storeId}`);
                    return;
                }
                const prices = await scraper.fetchPrices(ingredientIds);
                results.push(...prices);
                // Track successful scrape
                monitoring.trackDatabaseOperation('scrape', storeId, prices.length);
            }
            catch (error) {
                logger.error(`Failed to fetch prices from store ${storeId}`, error);
            }
        }));
        return results;
    }
    /**
     * Get all current deals from stores in a country
     */
    async getDealsForCountry(country) {
        const cacheKey = `deals:${country}`;
        const cachedDeals = await cache.get(cacheKey);
        if (cachedDeals) {
            return cachedDeals;
        }
        const countryStores = countryConfig[country]?.stores || [];
        const results = [];
        await Promise.all(countryStores.map(async (storeId) => {
            try {
                const scraper = this.scrapers.get(storeId);
                if (!scraper) {
                    logger.warn(`No scraper found for store ${storeId}`);
                    return;
                }
                const deals = await scraper.fetchDeals();
                results.push(...deals);
            }
            catch (error) {
                logger.error(`Failed to fetch deals from store ${storeId}`, error);
            }
        }));
        // Cache deals for 1 hour
        await cache.set(cacheKey, results, { ttl: 3600 });
        return results;
    }
    /**
     * Validate all stores in a country
     */
    async validateStoresForCountry(country) {
        const countryStores = countryConfig[country]?.stores || [];
        const results = new Map();
        await Promise.all(countryStores.map(async (storeId) => {
            try {
                const scraper = this.scrapers.get(storeId);
                if (!scraper) {
                    results.set(storeId, false);
                    return;
                }
                const isValid = await scraper.validateStore();
                results.set(storeId, isValid);
            }
            catch (error) {
                logger.error(`Failed to validate store ${storeId}`, error);
                results.set(storeId, false);
            }
        }));
        return results;
    }
    /**
     * Save scraped prices to database
     */
    async savePrices(prices) {
        if (!prices.length)
            return;
        try {
            const db = await connectToDatabase();
            const existingPrices = await db.collection('ingredient_prices').find().toArray();
            // Generate cache key
            const cacheKey = `scraper:${prices[0].storeId}:${Date.now()}`;
            // Cache the results with proper options
            await cache.set(cacheKey, prices, { ttl: 3600 });
            // Mark old prices as invalid
            const ops = existingPrices.map(price => ({
                updateOne: {
                    filter: {
                        ingredientId: price.ingredientId,
                        storeId: price.storeId,
                        validTo: null
                    }, // Type assertion needed for MongoDB filter
                    update: {
                        $set: { validTo: new Date() }
                    }
                }
            }));
            // Close old prices
            await db.collection('ingredient_prices').bulkWrite(ops);
            // Insert new prices
            await db.collection('ingredient_prices').insertMany(prices.map(price => ({
                ...price,
                createdAt: new Date(),
                updatedAt: new Date(),
            })));
            logger.info(`Saved ${prices.length} prices to database`);
        }
        catch (error) {
            logger.error('Failed to save prices', error);
            throw error;
        }
    }
}
export const scraperManager = ScraperManager.getInstance();
//# sourceMappingURL=scraper.manager.js.map
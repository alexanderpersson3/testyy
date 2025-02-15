import { ScraperInterface } from '../base.scraper.js';
import { ScrapedIngredient } from '../../types/ingredient.js';
export declare class ScraperManager {
    private static instance;
    private scrapers;
    private stores;
    private constructor();
    static getInstance(): ScraperManager;
    /**
     * Register a scraper for a specific store
     */
    registerScraper(storeId: string, scraper: ScraperInterface): void;
    /**
     * Initialize stores from database
     */
    initializeStores(): Promise<void>;
    /**
     * Get prices for ingredients from all relevant stores in a country
     */
    getPricesForCountry(country: string, ingredientIds: string[]): Promise<ScrapedIngredient[]>;
    /**
     * Get all current deals from stores in a country
     */
    getDealsForCountry(country: string): Promise<ScrapedIngredient[]>;
    /**
     * Validate all stores in a country
     */
    validateStoresForCountry(country: string): Promise<Map<string, boolean>>;
    /**
     * Save scraped prices to database
     */
    savePrices(prices: ScrapedIngredient[]): Promise<void>;
}
export declare const scraperManager: ScraperManager;

import type { StorePriceResponse } from '../types/index.js';
import { Store } from '../types/store.js';
export interface ScrapedPrice {
    price: number;
    oldPrice?: number;
    currency: string;
    quantity?: number;
    unit?: string;
    store: {
        name: string;
        logo?: string;
    };
    validFrom?: Date;
    createdAt?: Date;
    updatedAt?: Date;
}
export declare class StoreScraper {
    private static instance;
    private readonly CACHE_TTL;
    private readonly storeConfigs;
    private constructor();
    static getInstance(): StoreScraper;
    scrapeMatSparPrice(productName: string): Promise<ScrapedPrice | null>;
    getStore(storeId: string): Promise<Store | null>;
    /**
     * Scrape prices for a list of ingredients
     */
    scrapeIngredientPrices(ingredients: string[]): Promise<StorePriceResponse>;
    /**
     * Get configuration for a specific store
     */
    private getStoreConfig;
}

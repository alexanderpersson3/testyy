import { ScrapedIngredient } from '../types/ingredient.js';
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
export interface StoreConfig {
    baseUrl: string;
    searchEndpoint: string;
    selectors: {
        price: string;
        oldPrice?: string;
        name: string;
        image?: string;
    };
}
export declare class StoreScraper {
    private readonly CACHE_TTL;
    private readonly STORE_CONFIGS;
    constructor();
    scrapeMatSparPrice(productName: string): Promise<ScrapedPrice | null>;
    scrapeStore(storeId: string): Promise<ScrapedIngredient[]>;
}
//# sourceMappingURL=store-scraper.d.ts.map
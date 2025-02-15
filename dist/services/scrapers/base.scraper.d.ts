import { ScrapedIngredient, Store } from '../../types/ingredient.js';
export interface ScraperInterface {
    fetchPrices(ingredientIds: string[]): Promise<ScrapedIngredient[]>;
    fetchDeals(): Promise<ScrapedIngredient[]>;
    parseHTML(html: string): Promise<any>;
    validateStore(): Promise<boolean>;
}
export declare abstract class BaseScraper implements ScraperInterface {
    protected store: Store;
    protected baseUrl: string;
    protected headers: Record<string, string>;
    constructor(store: Store, baseUrl: string);
    abstract fetchPrices(ingredientIds: string[]): Promise<ScrapedIngredient[]>;
    abstract fetchDeals(): Promise<ScrapedIngredient[]>;
    abstract parseHTML(html: string): Promise<any>;
    validateStore(): Promise<boolean>;
    protected fetchWithRetry(url: string, options?: RequestInit, retries?: number): Promise<Response>;
    protected sanitizePrice(price: string): number;
    protected delay(ms: number): Promise<void>;
    protected generateUniqueId(storeId: string, externalId: string): string;
}

import { BaseScraper } from '../base.scraper.js';
import { Store, ScrapedIngredient } from '../../types/ingredient.js';
interface MatsparProduct {
    id: string;
    name: string;
    price: number;
    oldPrice?: number;
    unit: string;
    quantity: number;
    imageUrl?: string;
}
export declare class MatsparScraper extends BaseScraper {
    constructor(store: Store);
    fetchPrices(ingredientIds: string[]): Promise<ScrapedIngredient[]>;
    fetchDeals(): Promise<ScrapedIngredient[]>;
    parseHTML(html: string): Promise<MatsparProduct[]>;
}
export {};

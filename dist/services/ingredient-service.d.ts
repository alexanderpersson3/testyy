import { ObjectId } from 'mongodb';
import { Ingredient, CreateIngredientDTO, UpdateIngredientDTO, SearchIngredientsQuery, ScrapedIngredient, Store, CustomPrice } from '../types/ingredient.js';
export interface SearchResponse {
    ingredients: Ingredient[];
    total: number;
    createNew?: {
        suggestion: string;
        query: string;
    };
}
export interface AutoCompleteResponse {
    suggestions: {
        id: string;
        name: string;
        source: string;
        description?: string;
        isPublic: boolean;
    }[];
}
export interface IngredientWithPrices extends Ingredient {
    prices: {
        store: Store;
        price: number;
        currency: string;
        quantity: number;
        unit: string;
        convertedPrice?: {
            amount: number;
            currency: string;
        };
    }[];
}
export declare class IngredientService {
    private imageService;
    private currencyService;
    constructor();
    /**
     * Get auto-complete suggestions
     */
    getAutoCompleteSuggestions(query: string, userId?: string, limit?: number): Promise<AutoCompleteResponse>;
    /**
     * Get ingredient with prices
     */
    getIngredientWithPrices(ingredientId: string, targetCurrency?: string): Promise<IngredientWithPrices>;
    /**
     * Get upload URL for ingredient image
     */
    uploadImage(file: Express.Multer.File): Promise<string>;
    /**
     * Create a new user ingredient
     */
    createUserIngredient(userId: string, data: CreateIngredientDTO): Promise<ObjectId>;
    /**
     * Update an ingredient
     */
    updateIngredient(ingredientId: string, userId: string, data: UpdateIngredientDTO): Promise<void>;
    /**
     * Search ingredients
     */
    searchIngredients(query: SearchIngredientsQuery): Promise<SearchResponse>;
    /**
     * Get ingredient prices
     */
    getIngredientPrices(ingredientId: string): Promise<ScrapedIngredient[]>;
    /**
     * Upsert scraped ingredient
     */
    upsertScrapedIngredient(storeId: string, externalId: string, data: {
        name: string;
        price: number;
        currency: string;
        quantity: number;
        unit: string;
        sourceCountry: string;
    }): Promise<void>;
    /**
     * Delete an ingredient image
     */
    deleteImage(url: string): Promise<void>;
    /**
     * Update an ingredient's custom price
     */
    updateCustomPrice(ingredientId: string, customPrice: Omit<CustomPrice, 'updatedAt'>): Promise<void>;
}
export default IngredientService;
//# sourceMappingURL=ingredient-service.d.ts.map
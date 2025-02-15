import { Ingredient, CreateIngredientDTO, ScrapedIngredient, CustomPrice, IngredientWithPrices } from '../types/ingredient.js';
export interface SearchResponse {
    ingredients: Ingredient[];
    total: number;
    createNew?: {
        suggestion: string;
        query: string;
    };
}
export interface AutoCompleteResponse {
    suggestions: Array<{
        id: string;
        name: string;
        source: string;
        description?: string;
        isPublic: boolean;
    }>;
}
export declare class IngredientService {
    private static instance;
    private db;
    private imageService;
    private currencyService;
    private constructor();
    static getInstance(): IngredientService;
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
     * Create a new ingredient
     */
    createIngredient(data: CreateIngredientDTO): Promise<string>;
    /**
     * Create a user-submitted ingredient
     */
    createUserIngredient(userId: string, data: CreateIngredientDTO): Promise<string>;
    /**
     * Get ingredient by ID
     */
    getIngredient(id: string): Promise<Ingredient | null>;
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
        country: string;
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

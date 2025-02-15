import { Ingredient, CreateIngredientDTO, UpdateIngredientDTO, IngredientSearchQuery, IngredientStats, IngredientWithPrices, CustomIngredient } from '../types/ingredient.js';
export declare class IngredientService {
    private static instance;
    private constructor();
    static getInstance(): IngredientService;
    /**
     * Get an ingredient with its current prices
     */
    getIngredientWithPrices(ingredientId: string): Promise<IngredientWithPrices | null>;
    /**
     * Create a new ingredient
     */
    createIngredient(userId: string, data: CreateIngredientDTO): Promise<ObjectId>;
    /**
     * Get an ingredient by ID
     */
    getIngredient(ingredientId: string): Promise<Ingredient | null>;
    /**
     * Update an ingredient
     */
    updateIngredient(ingredientId: string, userId: string, data: UpdateIngredientDTO): Promise<void>;
    /**
     * Delete an ingredient
     */
    deleteIngredient(ingredientId: string, userId: string): Promise<void>;
    /**
     * Search ingredients
     */
    searchIngredients(query: IngredientSearchQuery): Promise<Ingredient[]>;
    /**
     * Verify an ingredient
     */
    verifyIngredient(ingredientId: string, verifierId: string): Promise<void>;
    /**
     * Reject an ingredient
     */
    rejectIngredient(ingredientId: string, verifierId: string): Promise<void>;
    /**
     * Get ingredient statistics
     */
    getStats(): Promise<IngredientStats>;
    /**
     * Create a custom ingredient
     */
    createCustomIngredient(data: CustomIngredient): Promise<ObjectId>;
    /**
     * Get a user's custom ingredients
     */
    getUserCustomIngredients(userId: string): Promise<Ingredient[]>;
    /**
     * Get a custom ingredient
     */
    getCustomIngredient(ingredientId: string, userId: string): Promise<Ingredient | null>;
    /**
     * Update a custom ingredient
     */
    updateCustomIngredient(ingredientId: string, userId: string, data: Partial<CustomIngredient>): Promise<void>;
    /**
     * Delete a custom ingredient
     */
    deleteCustomIngredient(ingredientId: string, userId: string): Promise<boolean>;
}

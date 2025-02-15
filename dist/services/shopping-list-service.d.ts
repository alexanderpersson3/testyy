import type { ObjectId } from '../types/index.js';
import { ShoppingList } from '../types/shopping-list.js';
import { IngredientWithPrices } from '../types/ingredient.js';
export declare class ShoppingListService {
    private static instance;
    private readonly db;
    private readonly wsService;
    private readonly ingredientService;
    private readonly mapService;
    private readonly categories;
    private constructor();
    static getInstance(): ShoppingListService;
    /**
     * Calculate total estimated price for a list of items
     */
    private calculateTotalPrice;
    /**
     * Create a new shopping list
     */
    createList(name: string, userId: ObjectId): Promise<ShoppingList>;
    /**
     * Generate a shopping list from a meal plan
     */
    generateFromMealPlan(mealPlanId: string, options?: {
        startDate?: Date;
        endDate?: Date;
        excludeIngredients?: string[];
    }): Promise<ObjectId>;
    /**
     * Update shopping list items
     */
    updateItems(shoppingListId: string, updates: Array<{
        name: string;
        amount?: number;
        isChecked?: boolean;
        notes?: string;
    }>): Promise<void>;
    /**
     * Get shopping list with organized categories
     */
    getOrganizedList(shoppingListId: string): Promise<{
        [category: string]: Array<{
            name: string;
            amount: number;
            unit: string;
            isChecked: boolean;
            notes?: string;
        }>;
    }>;
    addIngredientToList(listId: ObjectId, data: {
        ingredient: IngredientWithPrices;
        quantity: number;
        unit: string;
        notes?: string;
        category: string;
        addedBy: {
            id: string;
            name: string;
        };
    }): Promise<void>;
    private emitListEvent;
}
export declare const shoppingListService: ShoppingListService;

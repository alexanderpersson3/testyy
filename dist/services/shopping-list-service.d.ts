import { ObjectId } from 'mongodb';
declare class ShoppingListService {
    private readonly categories;
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
}
declare const _default: ShoppingListService;
export default _default;
//# sourceMappingURL=shopping-list-service.d.ts.map
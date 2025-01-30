import { NutritionalGoals } from '../types/recipe.js';
declare class NutritionService {
    /**
     * Calculate daily nutritional summary for a meal plan
     */
    calculateMealPlanNutrition(mealPlanId: string): Promise<void>;
    /**
     * Update user's nutritional goals
     */
    updateNutritionalGoals(userId: string, goals: NutritionalGoals): Promise<void>;
    /**
     * Get nutritional warnings for a specific date in a meal plan
     */
    getDailyNutritionalWarnings(mealPlanId: string, date: string): Promise<string[]>;
}
declare const _default: NutritionService;
export default _default;
//# sourceMappingURL=nutrition-service.d.ts.map
import { WeeklyMealPlan, MealPlanGenerationOptions, MealPlanSuggestion, MealPlanShoppingList, MealPlanAnalytics, DayOfWeek } from '../types/meal-planning.js';
export declare class MealPlanningService {
    private static instance;
    private recommendationService;
    private db;
    private shoppingListService;
    private constructor();
    static getInstance(): MealPlanningService;
    /**
     * Create a new meal plan
     */
    createMealPlan(userId: string, plan: Omit<WeeklyMealPlan, '_id' | 'userId' | 'createdAt' | 'updatedAt'>): Promise<WeeklyMealPlan>;
    /**
     * Update an existing meal plan
     */
    updateMealPlan(userId: string, planId: string, updates: Partial<WeeklyMealPlan>): Promise<WeeklyMealPlan>;
    /**
     * Delete a meal plan
     */
    deleteMealPlan(userId: string, planId: string): Promise<void>;
    /**
     * Get meal plans for a user
     */
    getMealPlans(userId: string, options?: {
        isActive?: boolean;
    }): Promise<WeeklyMealPlan[]>;
    /**
     * Generate meal plan suggestions
     */
    generateMealPlanSuggestions(userId: string, options: MealPlanGenerationOptions): Promise<Map<DayOfWeek, MealPlanSuggestion[]>>;
    /**
     * Create a meal plan from a template
     */
    createFromTemplate(userId: string, templateId: string, startDate: Date): Promise<WeeklyMealPlan>;
    /**
     * Generate shopping list from meal plan
     */
    generateShoppingList(userId: string, planId: string): Promise<MealPlanShoppingList>;
    /**
     * Get meal plan analytics
     */
    getMealPlanAnalytics(userId: string, planId: string): Promise<MealPlanAnalytics>;
    private getCurrentSeason;
    private calculateNutritionFit;
    private calculateBudgetFit;
    private calculateAverageNutrition;
    private evaluateNutritionGoals;
}

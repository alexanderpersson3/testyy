import { ObjectId } from 'mongodb';
import type { AddMealPlanRecipeDTO, UpdateMealPlanRecipeDTO } from '../types/index.js';
import type { MealPlan, CreateMealPlanDTO, UpdateMealPlanDTO, MealPlanStats } from '../types/index.js';
export declare class MealPlanService {
    private static instance;
    private recipeService;
    private db;
    private constructor();
    static getInstance(): MealPlanService;
    /**
     * Create a new meal plan
     */
    createPlan(userId: string, data: CreateMealPlanDTO): Promise<ObjectId>;
    /**
     * Get a meal plan by ID
     */
    getPlan(planId: string): Promise<MealPlan | null>;
    /**
     * Update a meal plan
     */
    updatePlan(planId: string, userId: string, updates: UpdateMealPlanDTO): Promise<void>;
    /**
     * Add a meal to the meal plan
     */
    addMeal(planId: string, userId: string, data: AddMealPlanRecipeDTO): Promise<void>;
    /**
     * Update a meal in the meal plan
     */
    updateMeal(planId: string, mealIndex: number, userId: string, updates: UpdateMealPlanRecipeDTO): Promise<void>;
    /**
     * Remove a meal from the meal plan
     */
    removeMeal(planId: string, mealIndex: number, userId: string): Promise<void>;
    /**
     * Get meal plan statistics
     */
    getStats(userId: string): Promise<MealPlanStats>;
}

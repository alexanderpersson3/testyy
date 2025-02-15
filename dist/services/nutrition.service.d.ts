import { ObjectId } from 'mongodb';
import { NutritionalInfo } from '../types/recipe.js';
export declare class NutritionService {
    private static instance;
    private initialized;
    private db;
    private constructor();
    static getInstance(): NutritionService;
    private initialize;
    private ensureInitialized;
    calculateNutritionalInfo(ingredients: Array<{
        name: string;
        amount: number;
        unit: string;
    }>): Promise<NutritionalInfo>;
    updateRecipeNutrition(recipeId: ObjectId, userId: ObjectId, nutritionalInfo: NutritionalInfo): Promise<void>;
    getMealPlanNutrition(mealPlanId: ObjectId, userId: ObjectId): Promise<{
        totalNutrition: NutritionalInfo;
        dailyAverages: NutritionalInfo;
        days: number;
    }>;
    private calculateTotalNutrition;
    private calculateDailyAverages;
}

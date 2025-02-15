import { ObjectId } from 'mongodb';
import type { Recipe } from '../types/index.js';
import { NutritionalInfo } from '../recipe.js';
export interface MealPlanRecipe {
    _id?: ObjectId;
    recipe: Recipe;
    servings: number;
    date: Date;
    mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
    notes?: string;
    estimatedCost?: {
        amount: number;
        currency: string;
    };
}
export interface Meal {
    date: Date;
    recipeId: string;
    servings: number;
    mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
    notes?: string;
    nutritionalInfo?: NutritionalInfo;
}
export interface MealPlan {
    _id?: ObjectId;
    userId: ObjectId;
    name: string;
    description?: string;
    startDate: Date;
    endDate: Date;
    meals: Meal[];
    shoppingListId?: ObjectId;
    isArchived: boolean;
    createdAt: Date;
    updatedAt: Date;
}
export interface CreateMealPlanDTO {
    name: string;
    description?: string;
    startDate: Date;
    endDate: Date;
    budgetCap?: {
        amount: number;
        currency: string;
        period: 'daily' | 'weekly' | 'monthly' | 'total';
    };
}
export interface UpdateMealPlanDTO {
    name?: string;
    description?: string;
    startDate?: Date;
    endDate?: Date;
    budgetCap?: {
        amount: number;
        currency: string;
        period: 'daily' | 'weekly' | 'monthly' | 'total';
    };
    status?: 'active' | 'completed' | 'archived';
}
export interface AddMealPlanRecipeDTO {
    recipeId: string;
    servings: number;
    date: Date;
    mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
    notes?: string;
}
export interface UpdateMealPlanRecipeDTO {
    servings?: number;
    date?: Date;
    mealType?: 'breakfast' | 'lunch' | 'dinner' | 'snack';
    notes?: string;
}
export interface MealPlanStats {
    totalPlans: number;
    activePlans: number;
    completedPlans: number;
    archivedPlans: number;
    averageRecipesPerPlan: number;
    mostUsedRecipes: Array<{
        recipeId: ObjectId;
        name: string;
        count: number;
    }>;
    averageCostPerDay: {
        amount: number;
        currency: string;
    };
    budgetUtilization: number;
    mealTypeDistribution: {
        breakfast: number;
        lunch: number;
        dinner: number;
        snack: number;
    };
}
export interface MealPlanBudgetAlert {
    type: 'warning' | 'exceeded';
    message: string;
    currentAmount: number;
    budgetCap: number;
    currency: string;
    period: 'daily' | 'weekly' | 'monthly' | 'total';
    date?: Date;
}

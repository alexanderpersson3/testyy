import type { Recipe } from '../types/express.js';
import { ObjectId } from 'mongodb';;;;
import type { BaseDocument } from '../types/express.js';
/**
 * Meal plan types
 */
export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'dessert';
export type DayOfWeek =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday';

/**
 * Nutrition types
 */
export interface NutritionRange {
  min: number;
  max: number;
}

export interface NutritionGoals {
  calories?: NutritionRange;
  protein?: NutritionRange;
  carbs?: NutritionRange;
  fat?: NutritionRange;
  fiber?: NutritionRange;
}

export interface NutritionInfo {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
}

/**
 * Budget types
 */
export interface BudgetInfo {
  currency: string;
  weeklyBudget: number;
  mealBudgets?: Partial<Record<MealType, number>>;
}

/**
 * Meal plan item representing a single meal in the plan
 */
export interface MealPlanItem {
  recipeId: ObjectId;
  mealType: MealType;
  servings: number;
  notes?: string;
  completed?: boolean;
}

/**
 * Daily meal plan containing meals for a specific day
 */
export interface DailyMealPlan {
  date: Date;
  dayOfWeek: DayOfWeek;
  meals: MealPlanItem[];
  notes?: string;
}

/**
 * Base weekly meal plan interface
 */
export interface BaseWeeklyMealPlan {
  userId: ObjectId;
  name: string;
  startDate: Date;
  endDate: Date;
  days: DailyMealPlan[];
  nutritionGoals?: NutritionGoals;
  dietaryRestrictions?: string[];
  budget?: BudgetInfo;
  notes?: string;
  isActive: boolean;
}

/**
 * Weekly meal plan containing daily plans
 */
export interface WeeklyMealPlan extends BaseWeeklyMealPlan, BaseDocument {}

/**
 * Shopping list item in a meal plan
 */
export interface MealPlanShoppingListItem {
  ingredient: string;
  amount: number;
  unit: string;
  recipes: Array<{
    recipeId: ObjectId;
    amount: number;
    unit: string;
  }>;
  purchased: boolean;
}

/**
 * Base shopping list interface
 */
export interface BaseMealPlanShoppingList {
  mealPlanId: ObjectId;
  userId: ObjectId;
  items: MealPlanShoppingListItem[];
  startDate: Date;
  endDate: Date;
}

/**
 * Shopping list generated from meal plan
 */
export interface MealPlanShoppingList extends BaseMealPlanShoppingList, BaseDocument {}

/**
 * Base meal plan template interface
 */
export interface BaseMealPlanTemplate {
  userId: ObjectId;
  name: string;
  description?: string;
  days: Array<{
    dayOfWeek: DayOfWeek;
    meals: Array<Omit<MealPlanItem, 'completed'>>;
  }>;
  dietaryRestrictions?: string[];
  tags: string[];
  isPublic: boolean;
}

/**
 * Meal plan template
 */
export interface MealPlanTemplate extends BaseMealPlanTemplate, BaseDocument {}

/**
 * Meal plan generation options
 */
export interface MealPlanGenerationOptions {
  startDate: Date;
  endDate: Date;
  mealsPerDay: MealType[];
  servingsPerMeal: number;
  dietaryRestrictions?: string[];
  nutritionGoals?: NutritionGoals;
  budget?: BudgetInfo;
  excludeRecipes?: ObjectId[];
  preferredRecipes?: ObjectId[];
  seasonalPreference?: boolean;
}

/**
 * Meal plan suggestions
 */
export interface MealPlanSuggestion {
  recipeId: ObjectId;
  mealType: MealType;
  score: number;
  matchReasons: string[];
  nutritionFit: number;
  budgetFit: number;
  seasonalFit: number;
}

/**
 * Meal plan analytics
 */
export interface MealPlanAnalytics {
  mealPlanId: ObjectId;
  userId: ObjectId;
  period: {
    start: Date;
    end: Date;
  };
  adherence: {
    planned: number;
    completed: number;
    rate: number;
  };
  nutrition: {
    average: NutritionInfo;
    goals: {
      met: string[];
      missed: string[];
    };
  };
  budget: {
    planned: number;
    actual: number;
    variance: number;
  };
  createdAt: Date;
}

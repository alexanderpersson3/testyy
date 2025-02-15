;
;
import type { Collection } from 'mongodb';
import { ObjectId } from 'mongodb';;;;
import { DatabaseService } from '../db/database.service.js';;
import type { Recipe } from '../types/express.js';
import { NutritionalInfo } from '../types/recipe.js';;
import { DatabaseError } from '../utils/errors.js';;
import logger from '../utils/logger.js';

export class NutritionService {
  private static instance: NutritionService;
  private initialized: boolean = false;
  private db: DatabaseService;

  private constructor() {
    this.db = DatabaseService.getInstance();
  }

  public static getInstance(): NutritionService {
    if (!NutritionService.instance) {
      NutritionService.instance = new NutritionService();
    }
    return NutritionService.instance;
  }

  private async initialize(): Promise<void> {
    if (this.initialized) return;
    await this.db.connect();
    this.initialized = true;
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  async calculateNutritionalInfo(
    ingredients: Array<{ name: string; amount: number; unit: string }>
  ): Promise<NutritionalInfo> {
    await this.ensureInitialized();

    // Note: In a production environment, you would use a nutrition API or database
    // This is a simplified example with mock calculations
    let totalCalories = 0;
    let totalProtein = 0;
    let totalCarbs = 0;
    let totalFat = 0;
    let totalFiber = 0;
    let totalSugar = 0;
    let totalSodium = 0;

    // Mock nutritional values per 100g
    const nutritionDatabase: Record<
      string,
      {
        calories: number;
        protein: number;
        carbs: number;
        fat: number;
        fiber: number;
        sugar: number;
        sodium: number;
      }
    > = {
      chicken: { calories: 165, protein: 31, carbs: 0, fat: 3.6, fiber: 0, sugar: 0, sodium: 74 },
      rice: { calories: 130, protein: 2.7, carbs: 28, fat: 0.3, fiber: 0.4, sugar: 0.1, sodium: 1 },
      potato: { calories: 77, protein: 2, carbs: 17, fat: 0.1, fiber: 2.2, sugar: 0.8, sodium: 6 },
      carrot: { calories: 41, protein: 0.9, carbs: 10, fat: 0.2, fiber: 2.8, sugar: 4.7, sodium: 69 },
      tomato: { calories: 18, protein: 0.9, carbs: 3.9, fat: 0.2, fiber: 1.2, sugar: 2.6, sodium: 5 },
    };

    ingredients.forEach(ingredient => {
      const normalizedName = ingredient.name.toLowerCase();
      const nutritionInfo = nutritionDatabase[normalizedName];

      if (nutritionInfo) {
        // Convert to 100g equivalent
        let amountIn100g = ingredient.amount;
        if (ingredient.unit === 'g' || ingredient.unit === 'ml') {
          amountIn100g = ingredient.amount / 100;
        } else if (ingredient.unit === 'kg' || ingredient.unit === 'l') {
          amountIn100g = ingredient.amount * 10;
        }

        totalCalories += nutritionInfo.calories * amountIn100g;
        totalProtein += nutritionInfo.protein * amountIn100g;
        totalCarbs += nutritionInfo.carbs * amountIn100g;
        totalFat += nutritionInfo.fat * amountIn100g;
        totalFiber += nutritionInfo.fiber * amountIn100g;
        totalSugar += nutritionInfo.sugar * amountIn100g;
        totalSodium += nutritionInfo.sodium * amountIn100g;
      }
    });

    return {
      servingSize: '100g',
      calories: Math.round(totalCalories),
      protein: Math.round(totalProtein * 10) / 10,
      carbohydrates: Math.round(totalCarbs * 10) / 10,
      fat: Math.round(totalFat * 10) / 10,
      fiber: Math.round(totalFiber * 10) / 10,
      sugar: Math.round(totalSugar * 10) / 10,
      sodium: Math.round(totalSodium),
    };
  }

  async updateRecipeNutrition(
    recipeId: ObjectId,
    userId: ObjectId,
    nutritionalInfo: NutritionalInfo
  ): Promise<void> {
    await this.ensureInitialized();

    try {
      const result = await this.db.getCollection<Recipe>('recipes').updateOne(
        { _id: recipeId, 'author._id': userId },
        {
          $set: {
            nutritionalInfo,
            updatedAt: new Date(),
          },
        }
      );

      if (result.matchedCount === 0) {
        throw new Error('Recipe not found or unauthorized');
      }
    } catch (error) {
      logger.error('Failed to update recipe nutrition:', error);
      throw new DatabaseError('Failed to update recipe nutrition');
    }
  }

  async getMealPlanNutrition(mealPlanId: ObjectId, userId: ObjectId): Promise<{
    totalNutrition: NutritionalInfo;
    dailyAverages: NutritionalInfo;
    days: number;
  }> {
    await this.ensureInitialized();

    try {
      const mealPlan = await this.db.getCollection('meal_plans').findOne({
        _id: mealPlanId,
        userId,
      });

      if (!mealPlan) {
        throw new Error('Meal plan not found or unauthorized');
      }

      // Get all recipes in the meal plan
      const recipeIds = mealPlan.meals
        .map((meal: { recipeId: ObjectId }) => meal.recipeId)
        .filter((id: unknown): id is ObjectId => id instanceof ObjectId);

      const recipes = await this.db
        .getCollection<Recipe>('recipes')
        .find({ _id: { $in: recipeIds } })
        .toArray();

      // Calculate total nutritional information
      const totalNutrition = this.calculateTotalNutrition(mealPlan.meals, recipes);

      // Calculate daily averages
      const days = Math.ceil(
        (mealPlan.endDate.getTime() - mealPlan.startDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      const dailyAverages = this.calculateDailyAverages(totalNutrition, days);

      return {
        totalNutrition,
        dailyAverages,
        days,
      };
    } catch (error) {
      logger.error('Failed to get meal plan nutrition:', error);
      throw new DatabaseError('Failed to get meal plan nutrition');
    }
  }

  private calculateTotalNutrition(
    meals: Array<{ recipeId: ObjectId; servings: number }>,
    recipes: Recipe[]
  ): NutritionalInfo {
    const total: NutritionalInfo = {
      servingSize: 'total',
      calories: 0,
      protein: 0,
      carbohydrates: 0,
      fat: 0,
      fiber: 0,
      sugar: 0,
      sodium: 0,
    };

    meals.forEach(meal => {
      const recipe = recipes.find(r => r._id!.equals(meal.recipeId));
      if (recipe?.nutritionalInfo) {
        total.calories += (recipe.nutritionalInfo.calories || 0) * meal.servings;
        total.protein += (recipe.nutritionalInfo.protein || 0) * meal.servings;
        total.carbohydrates += (recipe.nutritionalInfo.carbohydrates || 0) * meal.servings;
        total.fat += (recipe.nutritionalInfo.fat || 0) * meal.servings;
        total.fiber += (recipe.nutritionalInfo.fiber || 0) * meal.servings;
        total.sugar += (recipe.nutritionalInfo.sugar || 0) * meal.servings;
        total.sodium += (recipe.nutritionalInfo.sodium || 0) * meal.servings;
      }
    });

    return {
      ...total,
      calories: Math.round(total.calories),
      protein: Math.round(total.protein * 10) / 10,
      carbohydrates: Math.round(total.carbohydrates * 10) / 10,
      fat: Math.round(total.fat * 10) / 10,
      fiber: Math.round(total.fiber * 10) / 10,
      sugar: Math.round(total.sugar * 10) / 10,
      sodium: Math.round(total.sodium),
    };
  }

  private calculateDailyAverages(total: NutritionalInfo, days: number): NutritionalInfo {
    return {
      servingSize: 'daily average',
      calories: Math.round(total.calories / days),
      protein: Math.round((total.protein / days) * 10) / 10,
      carbohydrates: Math.round((total.carbohydrates / days) * 10) / 10,
      fat: Math.round((total.fat / days) * 10) / 10,
      fiber: Math.round((total.fiber / days) * 10) / 10,
      sugar: Math.round((total.sugar / days) * 10) / 10,
      sodium: Math.round(total.sodium / days),
    };
  }
} 
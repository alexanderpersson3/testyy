;
;
import type { Collection } from 'mongodb';
import { ObjectId } from 'mongodb';;;;
import { DatabaseService } from '../db/database.service.js';;
import { cache } from '../services/cache.service.js';;
import { RecipeService } from '../services/recipe.service.js';;
import type { AddMealPlanRecipeDTO, UpdateMealPlanRecipeDTO } from '../types/express.js';
import type { MealPlan, Meal, CreateMealPlanDTO, UpdateMealPlanDTO, MealPlanStats } from '../types/express.js';
import type { Recipe } from '../types/express.js';

export class MealPlanService {
  private static instance: MealPlanService;
  private recipeService: RecipeService;
  private db: DatabaseService;

  private constructor() {
    this.db = DatabaseService.getInstance();
    this.recipeService = RecipeService.getInstance();
  }

  static getInstance(): MealPlanService {
    if (!MealPlanService.instance) {
      MealPlanService.instance = new MealPlanService();
    }
    return MealPlanService.instance;
  }

  /**
   * Create a new meal plan
   */
  async createPlan(userId: string, data: CreateMealPlanDTO): Promise<ObjectId> {
    const plan = {
      userId: new ObjectId(userId),
      name: data.name,
      description: data.description || '',
      startDate: data.startDate,
      endDate: data.endDate,
      meals: [],
      isArchived: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    } satisfies Omit<MealPlan, '_id'>;

    const result = await this.db.getCollection<MealPlan>('meal_plans').insertOne(plan);
    return result.insertedId;
  }

  /**
   * Get a meal plan by ID
   */
  async getPlan(planId: string): Promise<MealPlan | null> {
    return this.db.getCollection<MealPlan>('meal_plans').findOne({
      _id: new ObjectId(planId),
    });
  }

  /**
   * Update a meal plan
   */
  async updatePlan(planId: string, userId: string, updates: UpdateMealPlanDTO): Promise<void> {
    const plan = await this.getPlan(planId);
    if (!plan) {
      throw new Error('Meal plan not found');
    }

    if (plan.userId.toString() !== userId) {
      throw new Error('Not authorized to update this meal plan');
    }

    const updateData: Partial<MealPlan> = {
      ...updates,
      updatedAt: new Date(),
    };

    await this.db.getCollection<MealPlan>('meal_plans').updateOne(
      { _id: new ObjectId(planId) },
      { $set: updateData }
    );
  }

  /**
   * Add a meal to the meal plan
   */
  async addMeal(planId: string, userId: string, data: AddMealPlanRecipeDTO): Promise<void> {
    const plan = await this.getPlan(planId);
    if (!plan) {
      throw new Error('Meal plan not found');
    }

    if (plan.userId.toString() !== userId) {
      throw new Error('Not authorized to modify this meal plan');
    }

    const recipe = await this.recipeService.getRecipe(new ObjectId(data.recipeId));
    if (!recipe) {
      throw new Error('Recipe not found');
    }

    const meal = {
      recipeId: data.recipeId,
      servings: data.servings,
      date: data.date,
      mealType: data.mealType,
      notes: data.notes || '',
    } satisfies Meal;

    await this.db.getCollection<MealPlan>('meal_plans').updateOne(
      { _id: new ObjectId(planId) },
      {
        $push: { meals: meal },
        $set: { updatedAt: new Date() },
      }
    );
  }

  /**
   * Update a meal in the meal plan
   */
  async updateMeal(
    planId: string,
    mealIndex: number,
    userId: string,
    updates: UpdateMealPlanRecipeDTO
  ): Promise<void> {
    const plan = await this.getPlan(planId);
    if (!plan) {
      throw new Error('Meal plan not found');
    }

    if (plan.userId.toString() !== userId) {
      throw new Error('Not authorized to modify this meal plan');
    }

    if (mealIndex < 0 || mealIndex >= plan.meals.length) {
      throw new Error('Invalid meal index');
    }

    const updateData: { [key: string]: any } = {};
    Object.entries(updates).forEach(([key, value]) => {
      updateData[`meals.${mealIndex}.${key}`] = value;
    });

    await this.db.getCollection<MealPlan>('meal_plans').updateOne(
      { _id: new ObjectId(planId) },
      {
        $set: {
          ...updateData,
          updatedAt: new Date(),
        },
      }
    );
  }

  /**
   * Remove a meal from the meal plan
   */
  async removeMeal(planId: string, mealIndex: number, userId: string): Promise<void> {
    const plan = await this.getPlan(planId);
    if (!plan) {
      throw new Error('Meal plan not found');
    }

    if (plan.userId.toString() !== userId) {
      throw new Error('Not authorized to modify this meal plan');
    }

    if (mealIndex < 0 || mealIndex >= plan.meals.length) {
      throw new Error('Invalid meal index');
    }

    // Create a new meals array without the meal at the specified index
    const updatedMeals = [...plan.meals.slice(0, mealIndex), ...plan.meals.slice(mealIndex + 1)];

    // Update the meal plan with the filtered meals array
    await this.db.getCollection<MealPlan>('meal_plans').updateOne(
      { _id: new ObjectId(planId) },
      {
        $set: {
          meals: updatedMeals,
          updatedAt: new Date(),
        },
      }
    );
  }

  /**
   * Get meal plan statistics
   */
  async getStats(userId: string): Promise<MealPlanStats> {
    const userPlans = await this.db.getCollection<MealPlan>('meal_plans')
      .find({ userId: new ObjectId(userId) })
      .toArray();

    const stats: MealPlanStats = {
      totalPlans: userPlans.length,
      activePlans: userPlans.filter((plan: MealPlan) => !plan.isArchived).length,
      completedPlans: 0,
      archivedPlans: userPlans.filter((plan: MealPlan) => plan.isArchived).length,
      averageRecipesPerPlan: 0,
      mostUsedRecipes: [],
      averageCostPerDay: {
        amount: 0,
        currency: 'USD',
      },
      budgetUtilization: 0,
      mealTypeDistribution: {
        breakfast: 0,
        lunch: 0,
        dinner: 0,
        snack: 0,
      },
    };

    // Calculate meal type distribution
    const typeCounts = {
      breakfast: 0,
      lunch: 0,
      dinner: 0,
      snack: 0,
    };

    let mealCount = 0;
    for (const plan of userPlans) {
      for (const meal of plan.meals) {
        typeCounts[meal.mealType as keyof typeof typeCounts]++;
        mealCount++;
      }
    }

    if (mealCount > 0) {
      stats.mealTypeDistribution = {
        breakfast: typeCounts.breakfast / mealCount,
        lunch: typeCounts.lunch / mealCount,
        dinner: typeCounts.dinner / mealCount,
        snack: typeCounts.snack / mealCount,
      };
    }

    // Calculate average recipes per plan
    stats.averageRecipesPerPlan = mealCount / userPlans.length;

    // Find most used recipes
    const recipeUsage = new Map<string, { count: number; name: string }>();
    for (const plan of userPlans) {
      for (const meal of plan.meals) {
        const recipe = await this.recipeService.getRecipe(new ObjectId(meal.recipeId));
        if (recipe) {
          const count = recipeUsage.get(meal.recipeId)?.count || 0;
          recipeUsage.set(meal.recipeId, {
            count: count + 1,
            name: recipe.title,
          });
        }
      }
    }

    stats.mostUsedRecipes = Array.from(recipeUsage.entries())
      .map(([recipeId, { count, name }]) => ({
        recipeId: new ObjectId(recipeId),
        name,
        count,
      }))
      .sort((a: any, b: any) => b.count - a.count)
      .slice(0, 5);

    return stats;
  }
}

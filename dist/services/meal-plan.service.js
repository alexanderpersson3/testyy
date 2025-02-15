import { ObjectId } from 'mongodb';
;
import { DatabaseService } from '../db/database.service.js';
import { cache } from '../services/cache.service.js';
import { RecipeService } from '../services/recipe.service.js';
export class MealPlanService {
    constructor() {
        this.db = DatabaseService.getInstance();
        this.recipeService = RecipeService.getInstance();
    }
    static getInstance() {
        if (!MealPlanService.instance) {
            MealPlanService.instance = new MealPlanService();
        }
        return MealPlanService.instance;
    }
    /**
     * Create a new meal plan
     */
    async createPlan(userId, data) {
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
        };
        const result = await this.db.getCollection('meal_plans').insertOne(plan);
        return result.insertedId;
    }
    /**
     * Get a meal plan by ID
     */
    async getPlan(planId) {
        return this.db.getCollection('meal_plans').findOne({
            _id: new ObjectId(planId),
        });
    }
    /**
     * Update a meal plan
     */
    async updatePlan(planId, userId, updates) {
        const plan = await this.getPlan(planId);
        if (!plan) {
            throw new Error('Meal plan not found');
        }
        if (plan.userId.toString() !== userId) {
            throw new Error('Not authorized to update this meal plan');
        }
        const updateData = {
            ...updates,
            updatedAt: new Date(),
        };
        await this.db.getCollection('meal_plans').updateOne({ _id: new ObjectId(planId) }, { $set: updateData });
    }
    /**
     * Add a meal to the meal plan
     */
    async addMeal(planId, userId, data) {
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
        };
        await this.db.getCollection('meal_plans').updateOne({ _id: new ObjectId(planId) }, {
            $push: { meals: meal },
            $set: { updatedAt: new Date() },
        });
    }
    /**
     * Update a meal in the meal plan
     */
    async updateMeal(planId, mealIndex, userId, updates) {
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
        const updateData = {};
        Object.entries(updates).forEach(([key, value]) => {
            updateData[`meals.${mealIndex}.${key}`] = value;
        });
        await this.db.getCollection('meal_plans').updateOne({ _id: new ObjectId(planId) }, {
            $set: {
                ...updateData,
                updatedAt: new Date(),
            },
        });
    }
    /**
     * Remove a meal from the meal plan
     */
    async removeMeal(planId, mealIndex, userId) {
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
        await this.db.getCollection('meal_plans').updateOne({ _id: new ObjectId(planId) }, {
            $set: {
                meals: updatedMeals,
                updatedAt: new Date(),
            },
        });
    }
    /**
     * Get meal plan statistics
     */
    async getStats(userId) {
        const userPlans = await this.db.getCollection('meal_plans')
            .find({ userId: new ObjectId(userId) })
            .toArray();
        const stats = {
            totalPlans: userPlans.length,
            activePlans: userPlans.filter((plan) => !plan.isArchived).length,
            completedPlans: 0,
            archivedPlans: userPlans.filter((plan) => plan.isArchived).length,
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
                typeCounts[meal.mealType]++;
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
        const recipeUsage = new Map();
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
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);
        return stats;
    }
}
//# sourceMappingURL=meal-plan.service.js.map
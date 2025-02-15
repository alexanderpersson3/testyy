import { ObjectId } from 'mongodb';
;
import { DatabaseService } from '../db/database.service.js';
import { WeeklyMealPlan, DailyMealPlan, MealPlanItem, MealPlanTemplate, MealPlanGenerationOptions, MealPlanSuggestion, MealPlanShoppingList, MealPlanAnalytics, MealType, DayOfWeek, NutritionGoals, BudgetInfo, } from '../types/meal-planning.js';
import { RecommendationService } from '../recommendation.service.js';
import logger from '../utils/logger.js';
import { ShoppingListService } from '../shopping-list.service.js';
export class MealPlanningService {
    constructor() {
        this.db = DatabaseService.getInstance();
        this.recommendationService = RecommendationService.getInstance();
        this.shoppingListService = ShoppingListService.getInstance();
    }
    static getInstance() {
        if (!MealPlanningService.instance) {
            MealPlanningService.instance = new MealPlanningService();
        }
        return MealPlanningService.instance;
    }
    /**
     * Create a new meal plan
     */
    async createMealPlan(userId, plan) {
        const newPlan = {
            _id: new ObjectId(),
            userId: new ObjectId(userId),
            name: plan.name,
            startDate: plan.startDate,
            endDate: plan.endDate,
            days: plan.days,
            nutritionGoals: plan.nutritionGoals,
            dietaryRestrictions: plan.dietaryRestrictions,
            budget: plan.budget,
            notes: plan.notes,
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date()
        };
        await this.db.getCollection('meal_plans').insertOne(newPlan);
        return newPlan;
    }
    /**
     * Update an existing meal plan
     */
    async updateMealPlan(userId, planId, updates) {
        const updatedPlan = {
            ...updates,
            updatedAt: new Date(),
        };
        const result = await this.db.getCollection('meal_plans').findOneAndUpdate({ _id: new ObjectId(planId), userId: new ObjectId(userId) }, { $set: updatedPlan }, { returnDocument: 'after' });
        if (!result.value) {
            throw new Error('Meal plan not found');
        }
        return result.value;
    }
    /**
     * Delete a meal plan
     */
    async deleteMealPlan(userId, planId) {
        const result = await this.db.getCollection('meal_plans').deleteOne({
            _id: new ObjectId(planId),
            userId: new ObjectId(userId),
        });
        if (result.deletedCount === 0) {
            throw new Error('Meal plan not found');
        }
    }
    /**
     * Get meal plans for a user
     */
    async getMealPlans(userId, options = {}) {
        const query = { userId: new ObjectId(userId) };
        if (typeof options.isActive === 'boolean') {
            query.isActive = options.isActive;
        }
        return getCollection('meal_plans')
            .find(query)
            .sort({ startDate: -1 })
            .toArray();
    }
    /**
     * Generate meal plan suggestions
     */
    async generateMealPlanSuggestions(userId, options) {
        const suggestions = new Map();
        const daysOfWeek = [
            'monday',
            'tuesday',
            'wednesday',
            'thursday',
            'friday',
            'saturday',
            'sunday',
        ];
        // Get recipe recommendations for each day and meal type
        for (const day of daysOfWeek) {
            const daySuggestions = [];
            for (const mealType of options.mealsPerDay) {
                const recommendations = await this.recommendationService.getPersonalizedRecommendations(new ObjectId(userId), {
                    cuisine: options.dietaryRestrictions?.includes('cuisine')
                        ? options.dietaryRestrictions[0]
                        : undefined,
                    limit: 3,
                });
                // Convert recommendations to suggestions
                const mealSuggestions = recommendations.map(recipe => ({
                    recipeId: recipe._id,
                    mealType,
                    score: 1,
                    matchReasons: [],
                    nutritionFit: this.calculateNutritionFit(recipe, options.nutritionGoals || null),
                    budgetFit: this.calculateBudgetFit(recipe, options.budget || null, mealType),
                    seasonalFit: options.seasonalPreference ? 1 : 0,
                }));
                daySuggestions.push(...mealSuggestions);
            }
            suggestions.set(day, daySuggestions);
        }
        return suggestions;
    }
    /**
     * Create a meal plan from a template
     */
    async createFromTemplate(userId, templateId, startDate) {
        // Get template
        const template = await getCollection('meal_plan_templates').findOne({
            _id: new ObjectId(templateId),
            $or: [{ userId: new ObjectId(userId) }, { isPublic: true }],
        });
        if (!template) {
            throw new Error('Template not found');
        }
        // Calculate dates for each day
        const days = template.days.map((templateDay, index) => {
            const date = new Date(startDate);
            date.setDate(date.getDate() + index);
            return {
                date,
                dayOfWeek: templateDay.dayOfWeek,
                meals: templateDay.meals.map(meal => ({
                    ...meal,
                    completed: false,
                })),
                notes: '',
            };
        });
        // Create new plan
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 6);
        return this.createMealPlan(userId, {
            name: `${template.name} - ${startDate.toLocaleDateString()}`,
            startDate,
            endDate,
            days,
            dietaryRestrictions: template.dietaryRestrictions,
            isActive: true,
        });
    }
    /**
     * Generate shopping list from meal plan
     */
    async generateShoppingList(userId, planId) {
        // Get meal plan
        const plan = await getCollection('meal_plans').findOne({
            _id: new ObjectId(planId),
            userId: new ObjectId(userId),
        });
        if (!plan) {
            throw new Error('Meal plan not found');
        }
        // Get all recipes in the plan
        const recipeIds = new Set(plan.days.flatMap(day => day.meals.map(meal => meal.recipeId.toString())));
        const recipes = await getCollection('recipes')
            .find({ _id: { $in: Array.from(recipeIds).map(id => new ObjectId(id)) } })
            .toArray();
        // Aggregate ingredients
        const ingredients = new Map();
        for (const day of plan.days) {
            for (const meal of day.meals) {
                const recipe = recipes.find(r => r._id?.equals(meal.recipeId));
                if (!recipe)
                    continue;
                for (const ingredient of recipe.ingredients) {
                    const key = ingredient.name.toLowerCase();
                    const existing = ingredients.get(key);
                    if (existing && existing.unit === ingredient.unit) {
                        existing.amount += ingredient.amount * (meal.servings || 1);
                        existing.recipes.push({
                            recipeId: recipe._id,
                            amount: ingredient.amount * (meal.servings || 1),
                            unit: ingredient.unit,
                        });
                    }
                    else {
                        ingredients.set(key, {
                            name: ingredient.name,
                            amount: ingredient.amount * (meal.servings || 1),
                            unit: ingredient.unit,
                            recipes: [
                                {
                                    recipeId: recipe._id,
                                    amount: ingredient.amount * (meal.servings || 1),
                                    unit: ingredient.unit,
                                },
                            ],
                        });
                    }
                }
            }
        }
        return {
            _id: new ObjectId(),
            mealPlanId: new ObjectId(planId),
            userId: new ObjectId(userId),
            items: Array.from(ingredients.values()).map(item => ({
                ingredient: item.name,
                amount: item.amount,
                unit: item.unit,
                recipes: item.recipes,
                purchased: false,
            })),
            startDate: plan.startDate,
            endDate: plan.endDate,
            createdAt: new Date(),
            updatedAt: new Date(),
        };
    }
    /**
     * Get meal plan analytics
     */
    async getMealPlanAnalytics(userId, planId) {
        // Get meal plan
        const plan = await getCollection('meal_plans').findOne({
            _id: new ObjectId(planId),
            userId: new ObjectId(userId),
        });
        if (!plan) {
            throw new Error('Meal plan not found');
        }
        // Get all recipes
        const recipeIds = new Set(plan.days.flatMap(day => day.meals.map(meal => meal.recipeId.toString())));
        const recipes = await getCollection('recipes')
            .find({ _id: { $in: Array.from(recipeIds).map(id => new ObjectId(id)) } })
            .toArray();
        // Calculate analytics
        const averageNutrition = this.calculateAverageNutrition(plan, recipes);
        const { met, missed } = this.evaluateNutritionGoals(averageNutrition, plan.nutritionGoals);
        const totalMeals = plan.days.reduce((sum, day) => sum + day.meals.length, 0);
        const completedMeals = plan.days.reduce((sum, day) => sum + day.meals.filter(meal => meal.completed).length, 0);
        return {
            mealPlanId: new ObjectId(planId),
            userId: new ObjectId(userId),
            period: {
                start: plan.startDate,
                end: plan.endDate,
            },
            adherence: {
                planned: totalMeals,
                completed: completedMeals,
                rate: totalMeals > 0 ? completedMeals / totalMeals : 0,
            },
            nutrition: {
                average: averageNutrition,
                goals: {
                    met,
                    missed,
                },
            },
            budget: {
                planned: plan.budget?.weeklyBudget || 0,
                actual: 0,
                variance: 0,
            },
            createdAt: new Date(),
        };
    }
    getCurrentSeason() {
        const month = new Date().getMonth();
        if (month >= 2 && month <= 4)
            return 'spring';
        if (month >= 5 && month <= 7)
            return 'summer';
        if (month >= 8 && month <= 10)
            return 'fall';
        return 'winter';
    }
    calculateNutritionFit(recipe, goals) {
        if (!goals || !recipe.nutritionalInfo)
            return 1;
        const scores = [];
        if (goals.calories && recipe.nutritionalInfo.calories) {
            scores.push(Math.max(0, (recipe.nutritionalInfo.calories - goals.calories.min) /
                (goals.calories.max - goals.calories.min)));
        }
        if (goals.protein && recipe.nutritionalInfo.protein) {
            scores.push(Math.max(0, (recipe.nutritionalInfo.protein - goals.protein.min) /
                (goals.protein.max - goals.protein.min)));
        }
        if (goals.carbs && recipe.nutritionalInfo.carbohydrates) {
            scores.push(Math.max(0, (recipe.nutritionalInfo.carbohydrates - goals.carbs.min) /
                (goals.carbs.max - goals.carbs.min)));
        }
        if (goals.fat && recipe.nutritionalInfo.fat) {
            scores.push(Math.max(0, (recipe.nutritionalInfo.fat - goals.fat.min) / (goals.fat.max - goals.fat.min)));
        }
        if (goals.fiber && recipe.nutritionalInfo.fiber) {
            scores.push(Math.max(0, (recipe.nutritionalInfo.fiber - goals.fiber.min) / (goals.fiber.max - goals.fiber.min)));
        }
        return scores.length > 0 ? scores.reduce((sum, score) => sum + score, 0) / scores.length : 1;
    }
    calculateBudgetFit(recipe, budget, mealType) {
        if (!budget || !recipe.stats)
            return 1;
        const mealBudget = budget.mealBudgets?.[mealType] || budget.weeklyBudget / 21;
        if (!mealBudget)
            return 1;
        // This would need actual cost data
        return 1;
    }
    calculateAverageNutrition(plan, recipes) {
        const totalNutrition = {
            calories: 0,
            protein: 0,
            carbs: 0,
            fat: 0,
            fiber: 0,
        };
        let mealCount = 0;
        for (const day of plan.days) {
            for (const meal of day.meals) {
                const recipe = recipes.find(r => r._id?.equals(meal.recipeId));
                if (!recipe?.nutritionalInfo)
                    continue;
                totalNutrition.calories += (recipe.nutritionalInfo.calories || 0) * (meal.servings || 1);
                totalNutrition.protein += (recipe.nutritionalInfo.protein || 0) * (meal.servings || 1);
                totalNutrition.carbs += (recipe.nutritionalInfo.carbohydrates || 0) * (meal.servings || 1);
                totalNutrition.fat += (recipe.nutritionalInfo.fat || 0) * (meal.servings || 1);
                totalNutrition.fiber += (recipe.nutritionalInfo.fiber || 0) * (meal.servings || 1);
                mealCount++;
            }
        }
        // Calculate daily averages
        if (mealCount > 0) {
            Object.keys(totalNutrition).forEach(key => {
                totalNutrition[key] /= mealCount;
            });
        }
        return totalNutrition;
    }
    evaluateNutritionGoals(average, goals) {
        const met = [];
        const missed = [];
        if (!goals)
            return { met, missed };
        if (goals.calories) {
            if (average.calories >= goals.calories.min && average.calories <= goals.calories.max) {
                met.push('calories');
            }
            else {
                missed.push('calories');
            }
        }
        if (goals.protein) {
            if (average.protein >= goals.protein.min && average.protein <= goals.protein.max) {
                met.push('protein');
            }
            else {
                missed.push('protein');
            }
        }
        if (goals.carbs) {
            if (average.carbs >= goals.carbs.min && average.carbs <= goals.carbs.max) {
                met.push('carbs');
            }
            else {
                missed.push('carbs');
            }
        }
        if (goals.fat) {
            if (average.fat >= goals.fat.min && average.fat <= goals.fat.max) {
                met.push('fat');
            }
            else {
                missed.push('fat');
            }
        }
        if (goals.fiber) {
            if (average.fiber >= goals.fiber.min && average.fiber <= goals.fiber.max) {
                met.push('fiber');
            }
            else {
                missed.push('fiber');
            }
        }
        return { met, missed };
    }
}
MealPlanningService.instance = null;
//# sourceMappingURL=meal-planning.service.js.map
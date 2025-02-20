import { ObjectId } from 'mongodb';
;
class NutritionService {
    /**
     * Calculate daily nutritional summary for a meal plan
     */
    async calculateMealPlanNutrition(mealPlanId) {
        const mealPlan = await getCollection('meal_plans').findOne({
            _id: new ObjectId(mealPlanId),
        });
        if (!mealPlan) {
            throw new Error('Meal plan not found');
        }
        // Get all recipes
        const recipeIds = mealPlan.meals.map((meal) => meal.recipeId);
        const recipes = await getCollection('recipes')
            .find({ _id: { $in: recipeIds } })
            .toArray();
        // Get user's nutritional goals
        const user = await getCollection('users').findOne({ _id: mealPlan.userId }, { projection: { 'settings.nutritionalGoals': 1 } });
        const nutritionalGoals = user?.settings?.nutritionalGoals || mealPlan.nutritionalGoals;
        // Calculate daily summaries
        const dailySummary = {};
        for (const meal of mealPlan.meals) {
            const recipe = recipes.find((r) => r._id.equals(meal.recipeId));
            if (!recipe?.nutritionalInfo)
                continue;
            const dateKey = meal.date.toISOString().split('T')[0];
            if (!dailySummary[dateKey]) {
                dailySummary[dateKey] = {
                    calories: 0,
                    protein: 0,
                    carbs: 0,
                    fat: 0,
                    fiber: 0,
                    sodium: 0,
                    meetsGoals: true,
                    warnings: [],
                };
            }
            // Calculate nutritional values for this meal
            const multiplier = meal.servings;
            const info = recipe.nutritionalInfo;
            if (info) {
                dailySummary[dateKey].calories += (info.calories || 0) * multiplier;
                dailySummary[dateKey].protein += (info.protein || 0) * multiplier;
                dailySummary[dateKey].carbs += (info.carbohydrates || 0) * multiplier;
                dailySummary[dateKey].fat += (info.fat || 0) * multiplier;
                dailySummary[dateKey].fiber += (info.fiber || 0) * multiplier;
                dailySummary[dateKey].sodium += (info.sodium || 0) * multiplier;
            }
        }
        // Check against goals and generate warnings
        if (nutritionalGoals) {
            for (const [date, summary] of Object.entries(dailySummary)) {
                const warnings = [];
                if (nutritionalGoals.calories) {
                    if (summary.calories < nutritionalGoals.calories.min) {
                        warnings.push(`Du har ${nutritionalGoals.calories.min - summary.calories} kalorier kvar för dagen.`);
                    }
                    else if (summary.calories > nutritionalGoals.calories.max) {
                        warnings.push(`Du har överskridit ditt dagliga kaloriemål med ${summary.calories - nutritionalGoals.calories.max} kalorier.`);
                    }
                }
                if (nutritionalGoals.macros?.protein) {
                    if (summary.protein < nutritionalGoals.macros.protein.min) {
                        warnings.push(`Lågt proteinintag (${summary.protein}g av ${nutritionalGoals.macros.protein.min}g mål)`);
                    }
                }
                if (nutritionalGoals.macros?.carbs) {
                    if (summary.carbs > nutritionalGoals.macros.carbs.max) {
                        warnings.push(`Högt kolhydratintag (${summary.carbs}g av ${nutritionalGoals.macros.carbs.max}g mål)`);
                    }
                }
                if (nutritionalGoals.sodium && summary.sodium > nutritionalGoals.sodium.max) {
                    warnings.push(`Högt natriumintag (${summary.sodium}mg av ${nutritionalGoals.sodium.max}mg mål)`);
                }
                dailySummary[date].warnings = warnings;
                dailySummary[date].meetsGoals = warnings.length === 0;
            }
        }
        // Update meal plan with new summary
        await getCollection('meal_plans').updateOne({ _id: new ObjectId(mealPlanId) }, {
            $set: {
                dailyNutritionalSummary: dailySummary,
                updatedAt: new Date(),
            },
        });
    }
    /**
     * Update user's nutritional goals
     */
    async updateNutritionalGoals(userId, goals) {
        await getCollection('users').updateOne({ _id: new ObjectId(userId) }, {
            $set: {
                'settings.nutritionalGoals': goals,
                updatedAt: new Date(),
            },
        });
    }
    /**
     * Get nutritional warnings for a specific date in a meal plan
     */
    async getDailyNutritionalWarnings(mealPlanId, date) {
        const mealPlan = await getCollection('meal_plans').findOne({ _id: new ObjectId(mealPlanId) }, { projection: { dailyNutritionalSummary: 1 } });
        return mealPlan?.dailyNutritionalSummary?.[date]?.warnings || [];
    }
}
export default new NutritionService();
//# sourceMappingURL=nutrition-service.js.map
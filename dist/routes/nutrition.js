import express from 'express';
import { check, validationResult } from 'express-validator';
import { ObjectId } from 'mongodb';
import { auth } from '../middleware/auth.js';
import { connectToDatabase } from '../db/db.js';
import { asyncHandler } from '../utils/asyncHandler.js';
const router = express.Router();
// Calculate nutritional information for a recipe
router.post('/calculate', auth, [
    check('ingredients').isArray().notEmpty(),
    check('ingredients.*.name').trim().notEmpty(),
    check('ingredients.*.amount').isFloat({ min: 0 }),
    check('ingredients.*.unit').trim().notEmpty()
], asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    // Note: In a production environment, you would integrate with a nutrition API
    // For this example, we'll use a simple calculation based on common ingredients
    const nutritionalInfo = calculateNutritionalInfo(req.body.ingredients);
    res.json({ nutritionalInfo });
}));
// Update recipe nutritional information
router.put('/recipes/:id', auth, [
    check('nutritionalInfo').isObject(),
    check('nutritionalInfo.servingSize').trim().notEmpty(),
    check('nutritionalInfo.calories').isFloat({ min: 0 }),
    check('nutritionalInfo.protein').isFloat({ min: 0 }),
    check('nutritionalInfo.carbohydrates').isFloat({ min: 0 }),
    check('nutritionalInfo.fat').isFloat({ min: 0 }),
    check('nutritionalInfo.fiber').isFloat({ min: 0 }),
    check('nutritionalInfo.sugar').isFloat({ min: 0 }),
    check('nutritionalInfo.sodium').isFloat({ min: 0 })
], asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    const db = await connectToDatabase();
    const userId = new ObjectId(req.user.id);
    const recipeId = new ObjectId(req.params.id);
    const result = await db.collection('recipes').updateOne({ _id: recipeId, userId }, {
        $set: {
            nutritionalInfo: req.body.nutritionalInfo,
            updatedAt: new Date()
        }
    });
    if (result.matchedCount === 0) {
        return res.status(404).json({ message: 'Recipe not found or unauthorized' });
    }
    res.json({ success: true });
}));
// Calculate total nutritional information for a meal plan
router.get('/meal-plans/:id', auth, asyncHandler(async (req, res) => {
    const db = await connectToDatabase();
    const userId = new ObjectId(req.user.id);
    const mealPlanId = new ObjectId(req.params.id);
    const mealPlan = await db.collection('meal_plans').findOne({
        _id: mealPlanId,
        userId
    });
    if (!mealPlan) {
        return res.status(404).json({ message: 'Meal plan not found or unauthorized' });
    }
    // Get all recipes in the meal plan
    const recipeIds = [...new Set(mealPlan.meals.map((meal) => meal.recipeId))];
    const recipes = await db.collection('recipes')
        .find({ _id: { $in: recipeIds } })
        .toArray();
    // Calculate total nutritional information
    const totalNutrition = calculateTotalNutrition(mealPlan.meals, recipes);
    // Calculate daily averages
    const days = Math.ceil((mealPlan.endDate.getTime() - mealPlan.startDate.getTime()) / (1000 * 60 * 60 * 24));
    const dailyAverages = calculateDailyAverages(totalNutrition, days);
    res.json({
        totalNutrition,
        dailyAverages,
        days
    });
}));
// Helper function to calculate nutritional information for ingredients
function calculateNutritionalInfo(ingredients) {
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
    const nutritionDatabase = {
        chicken: { calories: 165, protein: 31, carbs: 0, fat: 3.6, fiber: 0, sugar: 0, sodium: 74 },
        rice: { calories: 130, protein: 2.7, carbs: 28, fat: 0.3, fiber: 0.4, sugar: 0.1, sodium: 1 },
        potato: { calories: 77, protein: 2, carbs: 17, fat: 0.1, fiber: 2.2, sugar: 0.8, sodium: 6 },
        carrot: { calories: 41, protein: 0.9, carbs: 10, fat: 0.2, fiber: 2.8, sugar: 4.7, sodium: 69 },
        tomato: { calories: 18, protein: 0.9, carbs: 3.9, fat: 0.2, fiber: 1.2, sugar: 2.6, sodium: 5 },
        // Add more ingredients as needed
    };
    ingredients.forEach(ingredient => {
        const normalizedName = ingredient.name.toLowerCase();
        const nutritionInfo = nutritionDatabase[normalizedName];
        if (nutritionInfo) {
            // Convert to 100g equivalent
            let amountIn100g = ingredient.amount;
            if (ingredient.unit === 'g' || ingredient.unit === 'ml') {
                amountIn100g = ingredient.amount / 100;
            }
            else if (ingredient.unit === 'kg' || ingredient.unit === 'l') {
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
        sodium: Math.round(totalSodium)
    };
}
// Helper function to calculate total nutritional information for a meal plan
function calculateTotalNutrition(meals, recipes) {
    const total = {
        servingSize: 'total',
        calories: 0,
        protein: 0,
        carbohydrates: 0,
        fat: 0,
        fiber: 0,
        sugar: 0,
        sodium: 0
    };
    meals.forEach(meal => {
        const recipe = recipes.find(r => r._id.equals(meal.recipeId));
        if (recipe?.nutritionalInfo) {
            total.calories += recipe.nutritionalInfo.calories * meal.servings;
            total.protein += recipe.nutritionalInfo.protein * meal.servings;
            total.carbohydrates += recipe.nutritionalInfo.carbohydrates * meal.servings;
            total.fat += recipe.nutritionalInfo.fat * meal.servings;
            total.fiber += recipe.nutritionalInfo.fiber * meal.servings;
            total.sugar += recipe.nutritionalInfo.sugar * meal.servings;
            total.sodium += recipe.nutritionalInfo.sodium * meal.servings;
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
        sodium: Math.round(total.sodium)
    };
}
// Helper function to calculate daily averages
function calculateDailyAverages(total, days) {
    return {
        servingSize: 'daily average',
        calories: Math.round(total.calories / days),
        protein: Math.round((total.protein / days) * 10) / 10,
        carbohydrates: Math.round((total.carbohydrates / days) * 10) / 10,
        fat: Math.round((total.fat / days) * 10) / 10,
        fiber: Math.round((total.fiber / days) * 10) / 10,
        sugar: Math.round((total.sugar / days) * 10) / 10,
        sodium: Math.round(total.sodium / days)
    };
}
export default router;
//# sourceMappingURL=nutrition.js.map
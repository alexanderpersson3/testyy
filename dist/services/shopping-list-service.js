import { ObjectId } from 'mongodb';
import { connectToDatabase } from '../db/db.js';
class ShoppingListService {
    constructor() {
        this.categories = {
            'DAIRY': ['milk', 'cheese', 'yogurt', 'cream', 'butter'],
            'MEAT': ['chicken', 'beef', 'pork', 'fish', 'salmon'],
            'PRODUCE': ['apple', 'banana', 'lettuce', 'tomato', 'onion', 'garlic'],
            'GRAINS': ['rice', 'pasta', 'bread', 'flour', 'cereal'],
            'SPICES': ['salt', 'pepper', 'cinnamon', 'oregano', 'basil'],
            'CANNED': ['beans', 'tomatoes', 'soup', 'tuna'],
            'FROZEN': ['frozen', 'ice cream'],
            'BEVERAGES': ['water', 'juice', 'soda'],
            'SNACKS': ['chips', 'cookies', 'nuts'],
            'OTHER': []
        };
    }
    /**
     * Generate a shopping list from a meal plan
     */
    async generateFromMealPlan(mealPlanId, options = {}) {
        const db = await connectToDatabase();
        // Get meal plan with recipes
        const mealPlan = await db.collection('meal_plans').findOne({
            _id: new ObjectId(mealPlanId)
        });
        if (!mealPlan) {
            throw new Error('Meal plan not found');
        }
        // Filter meals by date range if specified
        let meals = mealPlan.meals;
        if (options.startDate || options.endDate) {
            meals = meals.filter(meal => {
                const mealDate = new Date(meal.date);
                if (options.startDate && mealDate < options.startDate)
                    return false;
                if (options.endDate && mealDate > options.endDate)
                    return false;
                return true;
            });
        }
        // Get all recipes
        const recipeIds = [...new Set(meals.map(meal => meal.recipeId))];
        const recipes = await db.collection('recipes')
            .find({ _id: { $in: recipeIds } })
            .toArray();
        // Combine ingredients
        const ingredientMap = new Map();
        for (const meal of meals) {
            const recipe = recipes.find(r => r._id.equals(meal.recipeId));
            if (!recipe)
                continue;
            const servingsMultiplier = meal.servings / recipe.servings;
            for (const ingredient of recipe.ingredients) {
                // Skip excluded ingredients
                if (options.excludeIngredients?.includes(ingredient.name.toLowerCase())) {
                    continue;
                }
                const key = `${ingredient.name.toLowerCase()}_${ingredient.unit.toLowerCase()}`;
                const existing = ingredientMap.get(key);
                if (existing) {
                    existing.amount += ingredient.amount * servingsMultiplier;
                    if (ingredient.notes && !existing.notes?.includes(ingredient.notes)) {
                        existing.notes = existing.notes
                            ? `${existing.notes}, ${ingredient.notes}`
                            : ingredient.notes;
                    }
                }
                else {
                    // Determine category
                    let category = 'OTHER';
                    for (const [cat, keywords] of Object.entries(this.categories)) {
                        if (keywords.some(keyword => ingredient.name.toLowerCase().includes(keyword.toLowerCase()))) {
                            category = cat;
                            break;
                        }
                    }
                    ingredientMap.set(key, {
                        name: ingredient.name,
                        amount: ingredient.amount * servingsMultiplier,
                        unit: ingredient.unit,
                        notes: ingredient.notes,
                        recipeId: recipe._id,
                        isChecked: false,
                        category
                    });
                }
            }
        }
        // Create shopping list
        const shoppingList = {
            userId: mealPlan.userId,
            name: `Shopping List for ${mealPlan.name}`,
            description: `Generated from meal plan: ${mealPlan.name}`,
            items: Array.from(ingredientMap.values()),
            recipeIds: recipeIds,
            servingsMultiplier: meals.reduce((acc, meal) => {
                acc[meal.recipeId.toString()] = meal.servings;
                return acc;
            }, {}),
            isArchived: false,
            createdAt: new Date(),
            updatedAt: new Date()
        };
        const result = await db.collection('shopping_lists').insertOne(shoppingList);
        // Update meal plan with shopping list reference
        await db.collection('meal_plans').updateOne({ _id: new ObjectId(mealPlanId) }, {
            $set: {
                shoppingListId: result.insertedId,
                updatedAt: new Date()
            }
        });
        return result.insertedId;
    }
    /**
     * Update shopping list items
     */
    async updateItems(shoppingListId, updates) {
        const db = await connectToDatabase();
        for (const update of updates) {
            await db.collection('shopping_lists').updateOne({
                _id: new ObjectId(shoppingListId),
                'items.name': update.name
            }, {
                $set: {
                    'items.$.amount': update.amount,
                    'items.$.isChecked': update.isChecked,
                    'items.$.notes': update.notes,
                    updatedAt: new Date()
                }
            });
        }
    }
    /**
     * Get shopping list with organized categories
     */
    async getOrganizedList(shoppingListId) {
        const db = await connectToDatabase();
        const shoppingList = await db.collection('shopping_lists').findOne({
            _id: new ObjectId(shoppingListId)
        });
        if (!shoppingList) {
            throw new Error('Shopping list not found');
        }
        const organized = {};
        for (const item of shoppingList.items) {
            const category = item.category || 'OTHER';
            if (!organized[category]) {
                organized[category] = [];
            }
            organized[category].push(item);
        }
        // Sort categories and items
        const result = {};
        Object.keys(this.categories).forEach(category => {
            if (organized[category]?.length > 0) {
                result[category] = organized[category].sort((a, b) => a.name.localeCompare(b.name));
            }
        });
        return result;
    }
}
export default new ShoppingListService();
//# sourceMappingURL=shopping-list-service.js.map
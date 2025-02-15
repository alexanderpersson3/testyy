import { DatabaseService } from '../db/database.service.js';
import { getWebSocketService } from '../websocket.js';
import { IngredientService } from '../ingredient.service.js';
import { MapService } from '../map.service.js';
import { ShoppingList, ShoppingListItem, ShoppingListEvent, ShoppingListRole, CreateShoppingListDTO, UpdateShoppingListDTO, AddShoppingListItemDTO, UpdateShoppingListItemDTO, AddCollaboratorDTO, ShoppingListStats, PriceComparison, PriceComparisonOptions, PriceAlertPreferences, } from '../types/shopping-list.js';
import { IngredientWithPrices } from '../types/ingredient.js';
import { ExtendedShoppingListItem, CollaboratorOperation } from '../types/shopping-list-service.js';
export class ShoppingListService {
    constructor() {
        this.categories = {
            PRODUCE: ['vegetable', 'fruit', 'herb', 'salad'],
            MEAT: ['meat', 'chicken', 'beef', 'pork', 'fish'],
            DAIRY: ['milk', 'cheese', 'yogurt', 'cream', 'butter'],
            BAKERY: ['bread', 'pastry', 'cake', 'flour'],
            PANTRY: ['spice', 'oil', 'sauce', 'canned', 'pasta', 'rice'],
            FROZEN: ['frozen', 'ice cream'],
            BEVERAGES: ['drink', 'juice', 'soda', 'water'],
            OTHER: [],
        };
        this.db = DatabaseService.getInstance();
        this.wsService = getWebSocketService();
        this.ingredientService = IngredientService.getInstance();
        this.mapService = MapService.getInstance();
    }
    static getInstance() {
        if (!ShoppingListService.instance) {
            ShoppingListService.instance = new ShoppingListService();
        }
        return ShoppingListService.instance;
    }
    /**
     * Calculate total estimated price for a list of items
     */
    calculateTotalPrice(items) {
        const pricesByCurrency = new Map();
        items.forEach(item => {
            const prices = item.ingredient?.prices;
            if (prices && prices.length > 0) {
                const lowestPrice = prices.reduce((min, price) => ((price.price ?? 0) < (min?.price ?? 0) ? price : min) ?? price, prices[0]);
                if (lowestPrice.currency && typeof lowestPrice.price === 'number') {
                    const currentTotal = pricesByCurrency.get(lowestPrice.currency) ?? 0;
                    pricesByCurrency.set(lowestPrice.currency, currentTotal + lowestPrice.price * item.quantity);
                }
            }
        });
        const [currency, amount] = Array.from(pricesByCurrency.entries())[0] ?? ['USD', 0];
        return { amount, currency };
    }
    /**
     * Create a new shopping list
     */
    async createList(name, userId) {
        const list = {
            _id: new ObjectId(),
            name,
            userId,
            owner: userId,
            collaborators: [{
                    userId,
                    role: 'editor',
                    joinedAt: new Date()
                }],
            items: [],
            status: 'active',
            createdAt: new Date(),
            updatedAt: new Date()
        };
        const result = await this.db.getCollection('shopping_lists').insertOne(list);
        return { ...list, _id: result.insertedId };
    }
    /**
     * Generate a shopping list from a meal plan
     */
    async generateFromMealPlan(mealPlanId, options = {}) {
        const mealPlan = await this.db.getCollection('meal_plans').findOne({
            _id: new ObjectId(mealPlanId),
        });
        if (!mealPlan) {
            throw new Error('Meal plan not found');
        }
        let meals = mealPlan.meals;
        if (options.startDate || options.endDate) {
            meals = meals.filter((meal) => {
                const mealDate = new Date(meal.date);
                if (options.startDate && mealDate < options.startDate)
                    return false;
                if (options.endDate && mealDate > options.endDate)
                    return false;
                return true;
            });
        }
        const recipeIds = [...new Set(meals.map((meal) => new ObjectId(meal.recipeId)))];
        const recipes = await this.db
            .getCollection('recipes')
            .find({ _id: { $in: recipeIds } })
            .toArray();
        const ingredientMap = new Map();
        for (const meal of meals) {
            const recipe = recipes.find((r) => r._id && r._id.equals(new ObjectId(meal.recipeId)));
            if (!recipe || typeof recipe.servings !== 'number')
                continue;
            const servingsMultiplier = meal.servings / recipe.servings;
            for (const ingredient of recipe.ingredients) {
                if (options.excludeIngredients?.includes(ingredient.name.toLowerCase())) {
                    continue;
                }
                const key = `${ingredient.name.toLowerCase()}_${ingredient.unit.toLowerCase()}`;
                const existing = ingredientMap.get(key);
                if (existing) {
                    existing.quantity += ingredient.amount * servingsMultiplier;
                    if (ingredient.notes && !existing.notes?.includes(ingredient.notes)) {
                        existing.notes = existing.notes
                            ? `${existing.notes}, ${ingredient.notes}`
                            : ingredient.notes;
                    }
                }
                else {
                    const ingredients = await this.ingredientService.searchIngredients({
                        query: ingredient.name,
                        limit: 1,
                    });
                    const firstIngredient = ingredients[0];
                    const ingredientId = firstIngredient?._id?.toString();
                    const ingredientDetails = ingredientId
                        ? await this.ingredientService.getIngredientWithPrices(ingredientId)
                        : null;
                    if (!ingredientDetails)
                        continue;
                    let category = 'OTHER';
                    for (const [cat, keywords] of Object.entries(this.categories)) {
                        if (keywords.some((keyword) => ingredient.name.toLowerCase().includes(keyword.toLowerCase()))) {
                            category = cat;
                            break;
                        }
                    }
                    ingredientMap.set(key, {
                        id: new ObjectId().toString(),
                        name: ingredient.name,
                        ingredient: ingredientDetails,
                        quantity: ingredient.amount * servingsMultiplier,
                        unit: ingredient.unit,
                        checked: false,
                        addedBy: {
                            id: mealPlan.userId.toString(),
                            name: 'User'
                        },
                        notes: ingredient.notes,
                        category,
                        createdAt: new Date(),
                        updatedAt: new Date()
                    });
                }
            }
        }
        const shoppingList = {
            _id: new ObjectId(),
            name: `Shopping List for ${mealPlan.name}`,
            description: `Generated from meal plan: ${mealPlan.name}`,
            userId: mealPlan.userId,
            owner: mealPlan.userId,
            collaborators: [],
            items: Array.from(ingredientMap.values()),
            status: 'active',
            recipeIds: recipeIds,
            servingsMultiplier: meals.reduce((acc, meal) => {
                acc[meal.recipeId] = meal.servings;
                return acc;
            }, {}),
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        const result = await this.db.getCollection('shopping_lists').insertOne(shoppingList);
        await this.db.getCollection('meal_plans').updateOne({ _id: new ObjectId(mealPlanId) }, {
            $set: {
                shoppingListId: result.insertedId,
                updatedAt: new Date(),
            },
        });
        return result.insertedId;
    }
    /**
     * Update shopping list items
     */
    async updateItems(shoppingListId, updates) {
        for (const update of updates) {
            await this.db.getCollection('shopping_lists').updateOne({
                _id: new ObjectId(shoppingListId),
                'items.name': update.name,
            }, {
                $set: {
                    'items.$.quantity': update.amount,
                    'items.$.checked': update.isChecked,
                    'items.$.notes': update.notes,
                    'items.$.updatedAt': new Date(),
                    updatedAt: new Date(),
                },
            });
        }
    }
    /**
     * Get shopping list with organized categories
     */
    async getOrganizedList(shoppingListId) {
        const shoppingList = await this.db.getCollection('shopping_lists').findOne({
            _id: new ObjectId(shoppingListId),
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
            organized[category].push({
                name: item.name,
                amount: item.quantity,
                unit: item.unit,
                isChecked: item.checked,
                notes: item.notes,
            });
        }
        const result = {};
        Object.keys(this.categories).forEach(category => {
            if (organized[category]?.length > 0) {
                result[category] = organized[category].sort((a, b) => a.name.localeCompare(b.name));
            }
        });
        return result;
    }
    async addIngredientToList(listId, data) {
        const item = {
            id: new ObjectId().toString(),
            name: data.ingredient.name,
            quantity: data.quantity,
            unit: data.unit,
            checked: false,
            addedBy: data.addedBy,
            notes: data.notes,
            category: data.category,
            createdAt: new Date(),
            updatedAt: new Date()
        };
        await this.db.getCollection('shopping_lists').updateOne({ _id: listId }, {
            $push: { items: item },
            $set: { updatedAt: new Date() }
        });
    }
    emitListEvent(event) {
        this.wsService.broadcast(`shopping_list:${event.listId}`, JSON.stringify(event));
    }
}
export const shoppingListService = ShoppingListService.getInstance();
//# sourceMappingURL=shopping-list-service.js.map
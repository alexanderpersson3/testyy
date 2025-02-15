import { DatabaseService } from '../db/database.service.js';
import { getWebSocketService } from '../websocket.js';
import { IngredientService } from '../ingredient.service.js';
import { ShoppingList, ShoppingListItem, ShoppingListEvent, ShoppingListRole, CreateShoppingListDTO, UpdateShoppingListDTO, AddShoppingListItemDTO, UpdateShoppingListItemDTO, AddCollaboratorDTO, ShoppingListStats, PriceComparison, PriceComparisonOptions, PriceAlertPreferences, } from '../types/shopping-list.js';
import { NotFoundError, DatabaseError } from '../utils/errors.js';
import { ExtendedShoppingListItem, CollaboratorOperation } from '../types/shopping-list-service.js';
import logger from '../utils/logger.js';
export class ShoppingListService {
    constructor() {
        this.COLLECTION = 'shopping_lists';
        this.ITEM_CATEGORIES = {
            produce: ['fruit', 'vegetable', 'herbs', 'fresh produce'],
            dairy: ['milk', 'cheese', 'yogurt', 'cream', 'butter', 'eggs'],
            meat: ['beef', 'chicken', 'pork', 'fish', 'seafood'],
            pantry: ['canned', 'dried', 'spices', 'condiments', 'oil', 'vinegar'],
            bakery: ['bread', 'pastry', 'baked goods'],
            frozen: ['frozen'],
            beverages: ['drink', 'juice', 'soda', 'water'],
            household: ['cleaning', 'paper goods', 'supplies'],
            other: [],
        };
        this.db = DatabaseService.getInstance();
        this.ws = getWebSocketService();
        this.ingredientService = IngredientService.getInstance();
    }
    static getInstance() {
        if (!this.instance) {
            this.instance = new ShoppingListService();
        }
        return this.instance;
    }
    getCollection() {
        return this.db.getCollection(this.COLLECTION);
    }
    categorizeItem(itemName) {
        const normalizedName = itemName.toLowerCase();
        for (const [category, keywords] of Object.entries(this.ITEM_CATEGORIES)) {
            if (keywords.some(keyword => normalizedName.includes(keyword))) {
                return category;
            }
        }
        return 'other';
    }
    calculateTotalPrice(items) {
        const pricesByCurrency = new Map();
        items.forEach(item => {
            const prices = item.ingredient?.prices;
            if (prices?.[0]) {
                // Initialize with first price to ensure we have a valid starting point
                let lowestPrice = prices[0];
                // Find the lowest price if there are multiple
                if (prices.length > 1) {
                    lowestPrice = prices.reduce((min, price) => ((price.price ?? 0) < (min.price ?? 0) ? price : min), lowestPrice);
                }
                if (lowestPrice.currency && typeof lowestPrice.price === 'number') {
                    const currentTotal = pricesByCurrency.get(lowestPrice.currency) ?? 0;
                    pricesByCurrency.set(lowestPrice.currency, currentTotal + lowestPrice.price * item.quantity);
                }
            }
        });
        const [currency, amount] = Array.from(pricesByCurrency.entries())[0] ?? ['USD', 0];
        return { amount, currency };
    }
    async addItems(userId, listId, items) {
        try {
            const newItems = items.map(item => ({
                id: new ObjectId().toString(),
                name: item.name,
                quantity: item.quantity,
                unit: item.unit,
                checked: false,
                category: item.category || this.categorizeItem(item.name),
                notes: item.notes,
                addedBy: {
                    id: userId,
                    name: 'User' // TODO: Get user name from user service
                },
                createdAt: new Date(),
                updatedAt: new Date()
            }));
            const result = await this.getCollection().findOneAndUpdate({ _id: new ObjectId(listId) }, {
                $push: { items: { $each: newItems } },
                $set: { updatedAt: new Date() }
            }, { returnDocument: 'after' });
            if (!result.value) {
                throw new Error('Shopping list not found');
            }
            return result.value;
        }
        catch (error) {
            logger.error('Failed to add items to shopping list:', error);
            throw new DatabaseError('Failed to add items to shopping list');
        }
    }
    async getList(listId, userId) {
        try {
            const list = await this.getCollection().findOne({
                _id: typeof listId === 'string' ? new ObjectId(listId) : listId,
                $or: [
                    { userId: typeof userId === 'string' ? new ObjectId(userId) : userId },
                    { 'collaborators.userId': typeof userId === 'string' ? new ObjectId(userId) : userId }
                ]
            });
            return list;
        }
        catch (error) {
            logger.error('Failed to get shopping list:', error);
            throw new DatabaseError('Failed to get shopping list');
        }
    }
    async updateItem(userId, listId, itemId, updates) {
        const updateData = {};
        for (const [key, value] of Object.entries(updates)) {
            updateData[`items.$.${key}`] = value;
        }
        updateData['items.$.updatedAt'] = new Date();
        const result = await this.getCollection().updateOne({
            _id: new ObjectId(listId),
            'items.id': itemId
        }, {
            $set: updateData
        });
        if (result.matchedCount === 0) {
            throw new NotFoundError('Shopping list or item not found');
        }
    }
}
ShoppingListService.instance = null;
export const shoppingListService = ShoppingListService.getInstance();
//# sourceMappingURL=shopping-list.service.js.map
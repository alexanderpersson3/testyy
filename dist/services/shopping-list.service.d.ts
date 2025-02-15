import type { ObjectId } from '../types/index.js';
import { ShoppingList } from '../types/shopping-list.js';
export declare class ShoppingListService {
    private static instance;
    private readonly COLLECTION;
    private db;
    private ws;
    private ingredientService;
    private readonly ITEM_CATEGORIES;
    private constructor();
    static getInstance(): ShoppingListService;
    private getCollection;
    private categorizeItem;
    private calculateTotalPrice;
    addItems(userId: string, listId: string, items: Array<{
        name: string;
        quantity: number;
        unit: string;
        category?: string;
        notes?: string;
    }>): Promise<ShoppingList>;
    getList(listId: string | ObjectId, userId: string | ObjectId): Promise<ShoppingList | null>;
    updateItem(userId: string, listId: string, itemId: string, updates: Partial<{
        quantity: number;
        unit: string;
        checked: boolean;
        notes: string;
        category: string;
    }>): Promise<void>;
}
export declare const shoppingListService: ShoppingListService;

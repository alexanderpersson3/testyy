export interface GroceryItem {
    _id?: ObjectId;
    name: string;
    amount: number;
    unit: string;
    category?: string;
    checked: boolean;
    recipeId?: ObjectId;
    collectionId?: ObjectId;
    userId: ObjectId;
    createdAt: Date;
    updatedAt: Date;
}
export interface GroceryList {
    _id?: ObjectId;
    userId: ObjectId;
    name: string;
    items: GroceryItem[];
    collectionId?: ObjectId;
    createdAt: Date;
    updatedAt: Date;
}
export declare class GroceryListService {
    /**
     * Create a new grocery list
     */
    createList(userId: string, name: string, collectionId?: string): Promise<ObjectId>;
    /**
     * Add items to grocery list
     */
    addItems(listId: string, items: Array<Omit<GroceryItem, '_id' | 'userId' | 'createdAt' | 'updatedAt'>>, userId: string): Promise<void>;
    /**
     * Add recipe ingredients to grocery list
     */
    addRecipeIngredients(listId: string, recipeId: string, userId: string): Promise<void>;
    /**
     * Add collection recipe ingredients to grocery list
     */
    addCollectionIngredients(listId: string, collectionId: string, userId: string): Promise<void>;
    /**
     * Update item status
     */
    updateItemStatus(listId: string, itemId: string, checked: boolean): Promise<void>;
    /**
     * Remove item from list
     */
    removeItem(listId: string, itemId: string): Promise<void>;
    /**
     * Clear completed items
     */
    clearCompleted(listId: string): Promise<void>;
    /**
     * Delete list
     */
    deleteList(listId: string, userId: string): Promise<void>;
    /**
     * Get user's grocery lists
     */
    getUserLists(userId: string): Promise<GroceryList[]>;
    /**
     * Get list by ID
     */
    getList(listId: string, userId: string): Promise<GroceryList | null>;
}

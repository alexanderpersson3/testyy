import { ObjectId } from 'mongodb';
type UpdateType = 'shopping_list_update' | 'recipe_update' | 'comment_update' | 'rating_update' | 'price_update' | 'inventory_update' | 'cooking_session_update';
interface UpdatePayload {
    type: UpdateType;
    resourceId: string;
    action: 'create' | 'update' | 'delete';
    data: any;
    userId: string;
    timestamp: number;
}
export declare class RealTimeUpdateService {
    private static instance;
    private wsService;
    private notificationService;
    private shoppingListService;
    private recipeService;
    private constructor();
    static getInstance(): RealTimeUpdateService;
    /**
     * Handle shopping list updates
     */
    handleShoppingListUpdate(listId: ObjectId, action: UpdatePayload['action'], data: any, userId: ObjectId): Promise<void>;
    /**
     * Handle recipe updates
     */
    handleRecipeUpdate(recipeId: ObjectId, action: UpdatePayload['action'], data: any, userId: ObjectId): Promise<void>;
    /**
     * Handle price updates
     */
    handlePriceUpdate(itemId: ObjectId, data: any, affectedLists: ObjectId[]): Promise<void>;
    /**
     * Handle cooking session updates
     */
    handleCookingSessionUpdate(sessionId: ObjectId, action: UpdatePayload['action'], data: any, userId: ObjectId): Promise<void>;
    /**
     * Subscribe a user to updates for specific topics
     */
    subscribeToUpdates(userId: ObjectId, topics: string[]): void;
    /**
     * Unsubscribe a user from specific topics
     */
    unsubscribeFromUpdates(userId: ObjectId, topics: string[]): void;
}
export {};

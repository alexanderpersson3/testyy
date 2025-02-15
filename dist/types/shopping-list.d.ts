import { ObjectId } from 'mongodb';
import type { MongoDocument } from '../types/index.js';
export interface ShoppingListItem {
    id: string;
    name: string;
    quantity: number;
    unit: string;
    checked: boolean;
    category?: string;
    notes?: string;
    addedBy: {
        id: string;
        name: string;
    };
    createdAt: Date;
    updatedAt: Date;
}
export type ShoppingListRole = 'editor' | 'viewer';
export interface ShoppingListCollaborator {
    userId: ObjectId;
    role: ShoppingListRole;
    joinedAt: Date;
}
export interface BaseShoppingList {
    name: string;
    description?: string;
    owner: ObjectId;
    userId: ObjectId;
    collaborators: Array<{
        userId: ObjectId;
        role: ShoppingListRole;
        joinedAt: Date;
    }>;
    items: ShoppingListItem[];
    store?: {
        _id: ObjectId;
        name: string;
    };
    status: ShoppingListStatus;
    totalEstimatedPrice?: {
        amount: number;
        currency: string;
    };
    recipeIds?: ObjectId[];
    servingsMultiplier?: Record<string, number>;
    completedAt?: Date;
    completedBy?: ObjectId;
    createdAt: Date;
    updatedAt: Date;
}
export interface ShoppingList extends BaseShoppingList, MongoDocument {
}
export type ShoppingListStatus = 'active' | 'completed' | 'archived';
export interface CreateListRequest {
    name: string;
    items?: Array<{
        name: string;
        quantity: number;
        unit: string;
        category?: string;
        notes?: string;
    }>;
    store?: {
        id: string;
        name: string;
    };
}
export interface AddItemsFromRecipeRequest {
    recipeId: string;
    servings?: number;
    excludeItems?: string[];
}
export interface VoiceInputResult {
    text: string;
    items: Array<{
        name: string;
        quantity?: number;
        unit?: string;
    }>;
    confidence: number;
}
export type ItemCategory = 'produce' | 'dairy' | 'meat' | 'pantry' | 'bakery' | 'frozen' | 'beverages' | 'household' | 'other';
export declare const ITEM_CATEGORIES: Record<ItemCategory, string[]>;
export type ShoppingListEventType = 'item_added' | 'item_removed' | 'item_updated' | 'item_checked' | 'list_updated' | 'collaborator_added' | 'collaborator_removed' | 'conflict';
export interface BaseShoppingListEvent {
    type: ShoppingListEventType;
    listId: string;
    userId: string;
    timestamp: Date;
}
export interface ItemAddedEvent extends BaseShoppingListEvent {
    type: 'item_added';
    data: {
        item: ShoppingListItem;
    };
}
export interface ItemRemovedEvent extends BaseShoppingListEvent {
    type: 'item_removed';
    data: {
        itemId: string;
    };
}
export interface ItemUpdatedEvent extends BaseShoppingListEvent {
    type: 'item_updated';
    data: {
        itemId: string;
        updates: Partial<ShoppingListItem>;
    };
}
export interface ItemCheckedEvent extends BaseShoppingListEvent {
    type: 'item_checked';
    data: {
        itemId: string;
        checked: boolean;
        checkedBy: string;
    };
}
export interface ListUpdatedEvent extends BaseShoppingListEvent {
    type: 'list_updated';
    data: {
        updates: Partial<ShoppingList>;
    };
}
export interface CollaboratorEvent extends BaseShoppingListEvent {
    type: 'collaborator_added' | 'collaborator_removed';
    data: {
        collaborator: {
            userId: string;
            role: ShoppingListRole;
        };
    };
}
export interface ConflictEvent extends BaseShoppingListEvent {
    type: 'conflict';
    data: {
        itemId: string;
        serverVersion: ShoppingListItem;
        clientVersion: ShoppingListItem;
        conflictingFields: string[];
    };
}
export type ShoppingListEvent = ItemAddedEvent | ItemRemovedEvent | ItemUpdatedEvent | ItemCheckedEvent | ListUpdatedEvent | CollaboratorEvent | ConflictEvent;
export interface CreateShoppingListDTO {
    name: string;
    description?: string;
    storeId?: string;
    items?: Array<{
        ingredientId: string;
        quantity: number;
        unit: string;
        notes?: string;
    }>;
}
export type UpdateShoppingListDTO = Partial<Pick<BaseShoppingList, 'name' | 'description' | 'status'>> & {
    storeId?: string;
};
export interface AddShoppingListItemDTO {
    ingredientId: string;
    quantity: number;
    unit: string;
    notes?: string;
}
export type UpdateShoppingListItemDTO = Partial<{
    amount: number;
    quantity: number;
    unit: string;
    checked: boolean;
    notes?: string;
    category?: string;
}>;
export interface AddCollaboratorDTO {
    userId: string;
    role: ShoppingListRole;
}
export interface ShoppingListStats {
    totalLists: number;
    activeLists: number;
    completedLists: number;
    archivedLists: number;
    averageItemsPerList: number;
    mostUsedIngredients: Array<{
        ingredientId: ObjectId;
        name: string;
        count: number;
        category?: string;
        averageCost: number;
        currency: string;
    }>;
    totalCollaborators: number;
    averageCompletionTime: number;
    timePerItem: number;
    topContributors: Array<{
        userId: ObjectId;
        name: string;
        listsContributed: number;
        itemsAdded: number;
        itemsChecked: number;
        totalActions: number;
    }>;
    shoppingPatterns: {
        byDayOfWeek: number[];
        byHourOfDay: number[];
        mostActiveDay: number;
        mostActiveHour: number;
    };
    lastUpdated: Date;
}
export interface BulkAddItemsDTO {
    items: Array<{
        ingredientId: string;
        quantity: number;
        unit: string;
        notes?: string;
        category?: string;
    }>;
}
export interface BulkUpdateItemsDTO {
    itemIds: string[];
    updates: Partial<Pick<ShoppingListItem, 'checked' | 'quantity' | 'unit' | 'notes' | 'category'>>;
}
export interface BulkRemoveItemsDTO {
    itemIds: string[];
}
export interface BulkOperationResult {
    success: boolean;
    modifiedCount: number;
    errors?: Array<{
        itemId?: string;
        message: string;
    }>;
}
export interface BaseShoppingListTemplate {
    name: string;
    description?: string;
    owner: ObjectId;
    isPublic: boolean;
    items: Array<{
        ingredientId: ObjectId;
        quantity: number;
        unit: string;
        notes?: string;
        category?: string;
    }>;
    store?: {
        _id: ObjectId;
        name: string;
    };
    tags: string[];
    usageCount: number;
    lastUsed?: Date;
}
export interface ShoppingListTemplate extends BaseShoppingListTemplate, MongoDocument {
}
export type CreateTemplateDTO = Omit<BaseShoppingListTemplate, 'owner' | 'usageCount' | 'lastUsed'> & {
    storeId?: string;
    items: Array<{
        ingredientId: string;
        quantity: number;
        unit: string;
        notes?: string;
        category?: string;
    }>;
};
export type UpdateTemplateDTO = Partial<CreateTemplateDTO>;
export interface CreateFromTemplateDTO {
    templateId: string;
    name?: string;
    description?: string;
    storeId?: string;
    quantityMultiplier?: number;
}
export interface TemplateSearchQuery {
    owner?: string;
    isPublic?: boolean;
    tags?: string[];
    sort?: keyof Pick<ShoppingListTemplate, 'name' | 'usageCount' | 'lastUsed' | 'createdAt'>;
    sortDirection?: 'asc' | 'desc';
    limit?: number;
    offset?: number;
}
export interface PriceComparison {
    stores: Array<{
        _id: ObjectId;
        name: string;
        totalPrice: number;
        savings: number;
        items: Array<{
            ingredientId: ObjectId;
            name: string;
            quantity: number;
            unit: string;
            price: number;
            originalPrice?: number;
            discount?: number;
            inStock: boolean;
            lastUpdated: Date;
        }>;
        unavailableItems: Array<{
            ingredientId: ObjectId;
            name: string;
        }>;
    }>;
    bestStore: {
        _id: ObjectId;
        name: string;
        totalPrice: number;
        savings: number;
    };
    priceRange: {
        min: number;
        max: number;
        currency: string;
    };
    lastUpdated: Date;
}
export interface PriceComparisonOptions {
    stores?: ObjectId[];
    maxDistance?: number;
    includeOnlineStores?: boolean;
    preferredStores?: ObjectId[];
    currency?: string;
}
export interface PriceAlertPreferences {
    enabled: boolean;
    threshold: number;
    currency: string;
    stores?: ObjectId[];
    notificationTypes: Array<'email' | 'push' | 'sms'>;
    frequency: 'daily' | 'weekly' | 'realtime';
    lastNotified?: Date;
}

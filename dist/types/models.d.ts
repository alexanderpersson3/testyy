import { ObjectId } from 'mongodb';
export interface BaseModel {
    _id: ObjectId;
    createdAt: Date;
    updatedAt: Date;
}
export interface RecipeCollection extends BaseModel {
    userId: ObjectId;
    name: string;
    description?: string;
    icon?: string;
    color?: string;
    recipeIds: ObjectId[];
    isDefault: boolean;
    order: number;
    collaborators: CollaboratorInfo[];
    isShared: boolean;
}
export interface CollaboratorInfo {
    userId: ObjectId;
    role: 'viewer' | 'editor';
    addedAt: Date;
}
export interface ShoppingList {
    _id?: ObjectId;
    userId: ObjectId;
    name: string;
    items: ShoppingListItem[];
    collaborators: Collaborator[];
    isShared: boolean;
    createdAt: Date;
    updatedAt: Date;
}
export interface ShoppingListItem {
    _id?: ObjectId;
    listId: ObjectId;
    ingredientId: ObjectId;
    quantity: number;
    unit: string;
    customName?: string;
    checked: boolean;
    createdAt: Date;
    updatedAt: Date;
}
export interface Collaborator {
    userId: ObjectId;
    role: 'editor' | 'viewer';
    addedAt: Date;
}
export interface Recipe extends BaseModel {
    title: string;
    description: string;
    ingredients: {
        name: string;
        amount: number;
        unit: string;
    }[];
    instructions: string[];
    prepTime: number;
    cookTime: number;
    servings: number;
    difficulty: 'easy' | 'medium' | 'hard';
    cuisine: string;
    category: string;
    tags: string[];
    authorId: ObjectId;
    originalRecipeId?: ObjectId;
    isPublished: boolean;
    status?: 'draft' | 'published' | 'archived';
}
export type CollectionEventType = 'collection_created' | 'collection_updated' | 'recipe_added' | 'recipe_removed' | 'collaborator_added' | 'collaborator_removed' | 'collaborator_updated' | 'collection_shared' | 'collection_unshared';
export interface RecipeSource {
    title: string;
    cuisine: string;
    difficulty: Recipe['difficulty'];
}
export interface RecipeSuggestion {
    title: string;
    cuisine: string;
    difficulty: Recipe['difficulty'];
    score: number;
}
export interface SearchHit<T = unknown> {
    _index: string;
    _type?: string;
    _id: string;
    _score: number | null;
    _source?: T;
}
export interface SearchResponse<T = unknown> {
    hits: {
        total: {
            value: number;
            relation: 'eq' | 'gte';
        };
        max_score: number | null;
        hits: Array<SearchHit<T>>;
    };
}
export type RecipeSearchHit = SearchHit<RecipeSource>;
export type RecipeSearchResponse = SearchResponse<RecipeSource>;
export declare function isRecipeSource(source: unknown): source is RecipeSource;
export interface UserSettings {
    userId: ObjectId;
    sortCheckedItems: boolean;
    sortByCategory: boolean;
    enableReminders: boolean;
    defaultStore?: string;
    sharedListsEnabled: boolean;
    createdAt: Date;
    updatedAt: Date;
}
//# sourceMappingURL=models.d.ts.map
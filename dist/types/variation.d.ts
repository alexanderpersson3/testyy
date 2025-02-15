import { ObjectId } from 'mongodb';
export interface VariationRating {
    userId: ObjectId;
    rating: number;
    success: boolean;
    review?: string;
    createdAt: Date;
}
export interface RecipeChanges {
    ingredients?: Array<{
        original: string;
        replacement: string;
        ratio?: number;
    }>;
    instructions?: Array<{
        stepIndex: number;
        change: string;
    }>;
    cookingTime?: {
        original: number;
        new: number;
    };
    temperature?: {
        original: number;
        new: number;
        unit: 'C' | 'F';
    };
}
export interface Variation {
    _id?: ObjectId;
    recipeId: ObjectId;
    name: string;
    description: string;
    changes: RecipeChanges;
    ratings: VariationRating[];
    averageRating: number;
    successRate: number;
    createdBy: ObjectId;
    createdAt: Date;
    updatedAt: Date;
    type?: VariationType;
    status?: 'draft' | 'published' | 'archived';
}
export type VariationType = 'ingredient' | 'instruction' | 'timing' | 'temperature' | 'equipment';
export interface IngredientChange {
    originalId?: ObjectId;
    action: 'add' | 'remove' | 'modify';
    ingredient: {
        name: string;
        amount: number;
        unit: string;
        notes?: string;
    };
    substitutes?: {
        name: string;
        amount: number;
        unit: string;
        notes?: string;
    }[];
}
export interface InstructionChange {
    originalIndex?: number;
    action: 'add' | 'remove' | 'modify';
    instruction: string;
    position: number;
}
export interface TimeChange {
    value: number;
    unit: 'minutes' | 'hours';
}
export interface DietaryChange {
    type: string;
    value: boolean;
    notes?: string;
}
export interface CreateVariationDTO {
    title: string;
    description?: string;
    type: VariationType;
    changes: RecipeChanges;
    status?: 'draft' | 'published';
}
export interface UpdateVariationDTO {
    title?: string;
    description?: string;
    type?: VariationType;
    changes?: RecipeChanges;
    status?: 'draft' | 'published';
}
export interface VariationQuery {
    parentRecipeId?: string;
    userId?: string;
    type?: VariationType;
    status?: 'draft' | 'published';
    isApproved?: boolean;
    search?: string;
    sort?: VariationSortType;
    limit?: number;
    offset?: number;
}
export type VariationSortType = 'newest' | 'popular' | 'rating';
export interface ApproveVariationDTO {
    approved: boolean;
    notes?: string;
}
export interface RateVariationDTO {
    rating: number;
    review?: string;
}

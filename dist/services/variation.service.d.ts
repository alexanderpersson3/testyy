import { ObjectId } from 'mongodb';
import type { RecipeChanges } from '../types/index.js';
import { Variation } from '../types/variation.js';
export declare class VariationService {
    private static instance;
    private constructor();
    static getInstance(): VariationService;
    createVariation(data: {
        recipeId: ObjectId;
        name: string;
        description: string;
        changes: RecipeChanges;
        createdBy: ObjectId;
    }): Promise<Variation>;
    getVariation(variationId: ObjectId): Promise<Variation | null>;
    getVariationsForRecipe(recipeId: ObjectId): Promise<Variation[]>;
    addRating(variationId: ObjectId, userId: ObjectId, rating: number, success: boolean, review?: string): Promise<void>;
    private updateAverages;
    deleteVariation(variationId: ObjectId, userId: ObjectId): Promise<boolean>;
}

import { ObjectId } from 'mongodb';
import type { BaseDocument } from '../types/index.js';
/**
 * Variation types
 */
export type VariationType = 'dietary' | 'ingredient' | 'method' | 'equipment' | 'seasonal' | 'regional';
/**
 * Recipe variation
 */
export interface RecipeVariation {
    originalRecipeId: ObjectId;
    name: string;
    description: string;
    type: string;
    changes: VariationChange[];
    authorId: ObjectId;
    status: 'draft' | 'published';
    reviews: number;
    isVerified: boolean;
}
export interface VariationDocument extends RecipeVariation, BaseDocument {
}
/**
 * Variation change types
 */
export type ChangeType = 'add_ingredient' | 'remove_ingredient' | 'substitute_ingredient' | 'adjust_amount' | 'add_step' | 'remove_step' | 'modify_step' | 'change_equipment' | 'adjust_time' | 'adjust_temperature';
/**
 * Variation change
 */
export interface VariationChange {
    type: 'add_ingredient' | 'remove_ingredient' | 'substitute_ingredient' | 'add_step' | 'remove_step' | 'modify_step' | 'adjust_time' | 'change_equipment';
    details: Record<string, any>;
    impact: {
        nutrition: boolean;
        allergens: boolean;
        difficulty: boolean;
        time: boolean;
        cost: boolean;
    };
}
/**
 * Variation suggestion
 */
export interface VariationSuggestion {
    recipeId: ObjectId;
    type: string;
    changes: VariationChange[];
    confidence: number;
    reasoning: string[];
    requirements?: {
        ingredients?: string[];
        equipment?: string[];
    };
}
/**
 * Variation compatibility
 */
export interface VariationCompatibility {
    variations: ObjectId[];
    isCompatible: boolean;
    conflicts?: Array<{
        type: string;
        description: string;
        variations: ObjectId[];
    }>;
    recommendations?: Array<{
        type: string;
        description: string;
        priority: 'low' | 'medium' | 'high';
    }>;
}
/**
 * Variation review
 */
export interface VariationReview {
    variationId: ObjectId;
    userId: ObjectId;
    rating: number;
    success: boolean;
    comment?: string;
    modifications?: string[];
}
export interface VariationReviewDocument extends VariationReview, BaseDocument {
}
/**
 * Variation stats
 */
export interface VariationStats {
    variationId: ObjectId;
    views: number;
    saves: number;
    attempts: number;
    successRate: number;
    averageRating: number;
    popularityScore: number;
    dietaryBreakdown: {
        [key: string]: number;
    };
    commonModifications: {
        change: string;
        count: number;
    }[];
}
export interface VariationStatsDocument extends VariationStats, BaseDocument {
}
/**
 * Variation search filters
 */
export interface VariationFilters {
    types?: string[];
    dietary?: string[];
    rating?: number;
    verifiedOnly?: boolean;
}
/**
 * Variation creation request
 */
export type CreateVariationRequest = {
    originalRecipeId: string;
    name: string;
    description: string;
    type: string;
    changes: VariationChange[];
};
/**
 * Variation update request
 */
export type UpdateVariationRequest = Partial<Omit<RecipeVariation, '_id' | 'authorId' | 'createdAt' | 'updatedAt'>>;

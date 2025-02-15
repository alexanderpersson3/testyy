import type { VariationDocument, VariationReviewDocument, VariationStatsDocument, CreateVariationRequest, UpdateVariationRequest } from '../types/index.js';
import { VariationReview, VariationSuggestion, VariationSearchQuery } from '../types/recipe-variation.js';
export declare class VariationsService {
    private static instance;
    private initialized;
    private recipesCollection;
    private variationsCollection;
    private reviewsCollection;
    private statsCollection;
    private constructor();
    private initialize;
    private ensureInitialized;
    static getInstance(): VariationsService;
    createVariation(userId: string, request: CreateVariationRequest): Promise<VariationDocument>;
    updateVariation(userId: string, variationId: string, updates: UpdateVariationRequest): Promise<VariationDocument>;
    deleteVariation(userId: string, variationId: string): Promise<void>;
    getVariations(query: VariationSearchQuery): Promise<VariationDocument[]>;
    getSuggestions(recipeId: string): Promise<VariationSuggestion[]>;
    addReview(userId: string, variationId: string, review: Omit<VariationReview, '_id' | 'variationId' | 'userId' | 'createdAt' | 'updatedAt'>): Promise<VariationReviewDocument>;
    getStats(variationId: string): Promise<VariationStatsDocument>;
    private updateVariationStats;
}

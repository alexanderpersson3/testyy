import { ObjectId } from 'mongodb';
import type { Recipe } from '../types/index.js';
export interface AIRecipeSuggestion {
    recipe: Recipe;
    confidence: number;
    reasoning: string;
}
export interface AIIngredientSubstitution {
    original: string;
    substitute: string;
    reasoning: string;
    dietaryNotes?: string[];
}
export interface AICookingTip {
    tip: string;
    context: string;
    source?: string;
}
export interface AIRecipeAnalysis {
    difficulty: {
        score: number;
        reasoning: string;
    };
    timeAccuracy: {
        score: number;
        suggestedAdjustments?: {
            prepTime?: number;
            cookTime?: number;
        };
        reasoning: string;
    };
    nutritionalBalance: {
        score: number;
        concerns?: string[];
        suggestions?: string[];
    };
    commonIssues?: {
        type: string;
        description: string;
        suggestion: string;
    }[];
}
export interface AIConversationContext {
    userId: ObjectId;
    recipeId?: ObjectId;
    sessionId?: string;
    previousMessages: Array<{
        role: 'user' | 'assistant';
        content: string;
    }>;
    currentStep?: number;
}
export interface AIConversationResponse {
    text: string;
    suggestions?: string[];
    relatedRecipes?: Array<{
        recipeId: ObjectId;
        relevance: number;
    }>;
    actions?: Array<{
        type: 'timer_start' | 'timer_adjust' | 'step_complete' | 'show_tip';
        payload: Record<string, any>;
    }>;
}
export interface AIEmbedding {
    _id?: ObjectId;
    recipeId: ObjectId;
    vector: number[];
    metadata: {
        title: string;
        ingredients: string[];
        tags: string[];
        updatedAt: Date;
    };
}
export interface AISearchQuery {
    ingredients?: string[];
    dietaryPreferences?: string[];
    timeConstraint?: number;
    skillLevel?: string;
    excludeIngredients?: string[];
    similarTo?: ObjectId;
}

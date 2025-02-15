import type { Recipe } from '../types/index.js';
interface AIRecipeRequest {
    ingredients: string[];
    preferences?: {
        cuisine?: string;
        dietary?: string[];
        difficulty?: 'easy' | 'medium' | 'hard';
        maxTime?: number;
    };
}
interface AIRecipeResponse {
    recipe: Partial<Recipe>;
    confidence: number;
    alternatives?: string[];
}
export declare class AIService {
    private static instance;
    private model;
    private constructor();
    static getInstance(): AIService;
    generateRecipe(request: AIRecipeRequest): Promise<AIRecipeResponse>;
    private buildRecipePrompt;
    private parseRecipeResponse;
    private parseIngredients;
    private parseInstructions;
    private calculateConfidence;
    private suggestAlternatives;
    private logRecipeGeneration;
}
export {};

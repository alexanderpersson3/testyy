import type { Recipe } from '../types/index.js';
import type { RecipeIngredient, RecipeInstruction, Difficulty } from '../types/index.js';
export declare class ValidationError extends Error {
    readonly message: string;
    readonly code: string;
    readonly field?: string | undefined;
    constructor(message: string, code: string, field?: string | undefined);
}
export interface ParsedRecipe {
    title: string;
    description?: string;
    ingredients: RecipeIngredient[];
    instructions: RecipeInstruction[];
    servings?: number;
    prepTime?: number;
    cookTime?: number;
    totalTime?: number;
    difficulty?: Difficulty;
    cuisine?: string;
    tags?: string[];
    source?: string;
    sourceUrl?: string;
    confidence: number;
}
export interface ParserOptions {
    extractTimes?: boolean;
    extractTags?: boolean;
    language?: string;
    minConfidence?: number;
}
export interface ParseError extends Error {
    code: string;
    details?: Record<string, unknown>;
}
export interface ParseResult {
    recipe: ParsedRecipe;
    warnings: string[];
}
export declare function parseRecipe(content: string, options?: ParserOptions): Promise<ParseResult>;
export declare function validateParsedRecipe(recipe: ParsedRecipe): boolean;
export declare function convertToRecipe(parsed: ParsedRecipe): Omit<Recipe, '_id'>;

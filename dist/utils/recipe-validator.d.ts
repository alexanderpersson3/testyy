import type { Recipe } from '../types/index.js';
export interface ValidationError {
    message: string;
    code: string;
    field?: string;
}
export interface ValidationWarning {
    message: string;
    code: string;
    field?: string;
}
export interface ValidationResult {
    isValid: boolean;
    errors: ValidationError[];
    warnings: ValidationWarning[];
}
export interface ValidationOptions {
    strictMode?: boolean;
    validateImages?: boolean;
    validateTimes?: boolean;
    minIngredients?: number;
    maxIngredients?: number;
    minInstructions?: number;
    maxInstructions?: number;
}
export declare function validateRecipe(recipe: Partial<Recipe>, options?: ValidationOptions): ValidationResult;

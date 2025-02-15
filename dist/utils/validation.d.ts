import type { BaseRecipe } from '../types/index.js';
interface ValidationError {
    field: string;
    message: string;
}
export declare function validateRecipe(recipe: Partial<BaseRecipe>): ValidationError[];
export declare function validateRecipeStrict(recipe: BaseRecipe): ValidationError[];
export {};

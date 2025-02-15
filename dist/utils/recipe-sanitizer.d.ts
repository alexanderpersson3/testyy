import type { Recipe } from '../types/index.js';
export interface SanitizeOptions {
    stripHtml?: boolean;
    normalizeText?: boolean;
    maxLength?: {
        title?: number;
        description?: number;
        instruction?: number;
    };
}
export declare function sanitizeRecipe(recipe: Recipe, options?: SanitizeOptions): Recipe;

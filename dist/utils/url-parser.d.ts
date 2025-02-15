import type { Recipe } from '../types/index.js';
interface ParsedRecipe {
    title: string;
    ingredients: string[];
    instructions: string[];
    prepTime?: number;
    cookTime?: number;
    totalTime?: number;
    servings?: number;
    imageUrl?: string;
    sourceUrl: string;
}
/**
 * Parse recipe from a URL
 */
export declare function parseRecipeFromUrl(url: string): Promise<Recipe>;
/**
 * Parse time string (e.g., "1 hour 30 minutes", "45 mins")
 */
export declare function parseTimeString(timeStr: string | null | undefined): number;
export declare function parseRecipeUrl(url: string): Promise<ParsedRecipe | null>;
export {};

import type { Recipe } from '../types/index.js';
import type { ExportOptions } from '../types/index.js';
interface FormattedRecipe {
    title: string;
    description?: string;
    servings: number;
    prepTime: number;
    cookTime: number;
    totalTime: number;
    difficulty: string;
    ingredients: Array<{
        name: string;
        amount: number;
        unit: string;
    }>;
    instructions: Array<{
        step: number;
        text: string;
        duration?: number;
        temperature?: {
            value: number;
            unit: 'C' | 'F';
        };
    }>;
    tags?: string[];
    imageUrl?: string;
}
/**
 * Format a recipe for export
 */
export declare function formatRecipeForExport(recipe: Recipe, options: ExportOptions): FormattedRecipe;
export declare function formatRecipe(recipe: Recipe): Recipe;
export {};

import type { Recipe } from '../types/index.js';
import type { ParsedRecipe } from '../types/index.js';
export declare function convertToRecipe(parsed: ParsedRecipe): Omit<Recipe, '_id'>;

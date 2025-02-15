import type { Recipe } from '../types/index.js';
export interface OCRResult {
    text: string;
    confidence: number;
}
export declare function parseRecipeFromImage(imagePath: string): Promise<Partial<Recipe>>;

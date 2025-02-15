import type { Recipe } from '../types/index.js';
export interface PDFGeneratorOptions {
    template?: string;
    includeImages?: boolean;
    includeNutrition?: boolean;
    includeMetadata?: boolean;
}
export declare function generatePDF(recipes: Recipe[], options?: PDFGeneratorOptions): Promise<Buffer>;

import type { Recipe } from '../types/index.js';
import type { Timer } from '../types/index.js';
interface MarkdownOptions {
    template?: string;
    imageStyle?: 'inline' | 'reference' | 'none';
    includeMetadataHeader?: boolean;
    includeMetadata?: boolean;
    includeNutrition?: boolean;
    includeTags?: boolean;
}
export declare function parseMarkdown(markdown: string): Recipe[];
export declare function generateMarkdown(recipes: Recipe[], options?: MarkdownOptions): string;
export declare function parseTimer(text: string): Timer | null;
export {};

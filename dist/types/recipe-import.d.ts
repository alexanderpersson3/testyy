import type { Request } from '../types/index.js';
import { ObjectId } from 'mongodb';
import { PDFExtract as PDFExtractBase, PDFExtractText } from 'pdf.js-extract';
declare module 'pdf.js-extract' {
    interface PDFExtractPage {
        content: PDFExtractText[];
    }
}
export interface FileRequest extends Request {
    file?: Express.Multer.File;
}
export interface ImportedRecipe {
    _id?: ObjectId;
    title: string;
    description: string;
    ingredients: string[];
    instructions: string[];
    prepTime?: number;
    cookTime?: number;
    servings?: number;
    difficulty: 'easy' | 'medium' | 'hard';
    cuisine: string;
    tags: string[];
    authorId: ObjectId;
    source: string;
    createdAt: Date;
    updatedAt: Date;
}
export interface RecipeSection {
    type: 'ingredients' | 'instructions' | 'other';
    content: string[];
}
export interface ExtractedRecipeData {
    title?: string;
    description?: string;
    sections: RecipeSection[];
    metadata: {
        prepTime?: number;
        cookTime?: number;
        servings?: number;
        cuisine?: string;
        difficulty?: 'easy' | 'medium' | 'hard';
        tags?: string[];
    };
}
export declare function validateRecipeData(data: ExtractedRecipeData): ImportedRecipe;
export declare function extractRecipeData(text: string): ExtractedRecipeData;
export interface PDFExtractResult {
    filename: string;
    pages: Array<{
        pageId: number;
        content: PDFExtractText[];
    }>;
}
export { PDFExtractBase as PDFExtract };

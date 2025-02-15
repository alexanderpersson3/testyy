import { ObjectId } from 'mongodb';
import type { Recipe } from '../types/index.js';
interface ImportResult {
    total: number;
    imported: number;
    failed: number;
    errors: Array<{
        row: number;
        error: string;
        data?: any;
    }>;
}
export declare class RecipeImportService {
    private static instance;
    private db;
    private cmsService;
    private constructor();
    static getInstance(): RecipeImportService;
    /**
     * Import recipes from CSV
     */
    importFromCSV(csvContent: string, userId: ObjectId): Promise<ImportResult>;
    /**
     * Export recipes to CSV
     */
    exportToCSV(query?: Partial<Recipe>): Promise<string>;
    /**
     * Parse recipe from CSV row
     */
    private parseRecipeFromRow;
}
export {};

export interface ImportResult {
    success: boolean;
    recipeId?: string;
    errors?: string[];
}
export interface ExportOptions {
    format: 'pdf' | 'json' | 'csv' | 'markdown';
    includeImages?: boolean;
    includeNutrition?: boolean;
    includeMetadata?: boolean;
    pdfTemplate?: string;
}
export declare class ImportExportService {
    private static instance;
    private db;
    private constructor();
    static getInstance(): ImportExportService;
    /**
     * Import recipe from file
     */
    importRecipe(userId: string, file: Express.Multer.File, format: string): Promise<ImportResult>;
    /**
     * Export recipes
     */
    exportRecipes(recipeIds: string[], options: ExportOptions): Promise<Buffer>;
    private parseJsonRecipe;
}

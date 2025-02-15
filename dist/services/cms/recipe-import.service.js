import { ObjectId } from 'mongodb';
;
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';
import { DatabaseService } from '../../db/database.service.js';
import logger from '../../utils/logger.js';
import { DatabaseError } from '../../utils/errors.js';
import { CMSService } from '../cms.service.js';
export class RecipeImportService {
    constructor() {
        this.db = DatabaseService.getInstance();
        this.cmsService = CMSService.getInstance();
    }
    static getInstance() {
        if (!RecipeImportService.instance) {
            RecipeImportService.instance = new RecipeImportService();
        }
        return RecipeImportService.instance;
    }
    /**
     * Import recipes from CSV
     */
    async importFromCSV(csvContent, userId) {
        const result = {
            total: 0,
            imported: 0,
            failed: 0,
            errors: [],
        };
        try {
            // Parse CSV content
            const rows = parse(csvContent, {
                columns: true,
                skip_empty_lines: true,
            });
            result.total = rows.length;
            // Process each row
            for (let i = 0; i < rows.length; i++) {
                try {
                    const row = rows[i];
                    const recipe = this.parseRecipeFromRow(row);
                    // Add recipe through CMS service
                    await this.cmsService.upsertRecipe({
                        ...recipe,
                        createdBy: userId,
                        status: 'draft',
                    });
                    result.imported++;
                }
                catch (error) {
                    result.failed++;
                    result.errors.push({
                        row: i + 1,
                        error: error instanceof Error ? error.message : 'Unknown error',
                        data: rows[i],
                    });
                }
            }
            return result;
        }
        catch (error) {
            logger.error('Failed to import recipes from CSV:', error);
            throw new DatabaseError('Failed to import recipes from CSV');
        }
    }
    /**
     * Export recipes to CSV
     */
    async exportToCSV(query = {}) {
        try {
            const recipes = await this.db.getCollection('recipes').find(query).toArray();
            const csvData = recipes.map(recipe => ({
                title: recipe.title,
                description: recipe.description,
                servings: recipe.servings,
                prepTime: recipe.prepTime,
                cookTime: recipe.cookTime,
                difficulty: recipe.difficulty,
                cuisine: recipe.cuisine || '',
                ingredients: JSON.stringify(recipe.ingredients),
                instructions: JSON.stringify(recipe.instructions),
                tags: recipe.tags.join(','),
                status: recipe.status || 'draft',
            }));
            return stringify(csvData, { header: true });
        }
        catch (error) {
            logger.error('Failed to export recipes to CSV:', error);
            throw new DatabaseError('Failed to export recipes to CSV');
        }
    }
    /**
     * Parse recipe from CSV row
     */
    parseRecipeFromRow(row) {
        // Validate required fields
        if (!row.title || !row.description || !row.ingredients || !row.instructions) {
            throw new Error('Missing required fields');
        }
        try {
            const ingredients = JSON.parse(row.ingredients);
            const instructions = JSON.parse(row.instructions);
            if (!Array.isArray(ingredients) || !Array.isArray(instructions)) {
                throw new Error('Invalid ingredients or instructions format');
            }
            return {
                title: row.title.trim(),
                description: row.description.trim(),
                servings: parseInt(row.servings, 10) || 1,
                prepTime: parseInt(row.prepTime, 10) || 0,
                cookTime: parseInt(row.cookTime, 10) || 0,
                difficulty: (row.difficulty || 'medium'),
                cuisine: row.cuisine?.trim(),
                ingredients,
                instructions,
                tags: row.tags ? row.tags.split(',').map((tag) => tag.trim()) : [],
            };
        }
        catch (error) {
            throw new Error('Invalid JSON format in ingredients or instructions');
        }
    }
}
RecipeImportService.instance = null;
//# sourceMappingURL=recipe-import.service.js.map
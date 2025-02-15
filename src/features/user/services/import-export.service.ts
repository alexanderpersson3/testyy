;
;
import type { Collection } from 'mongodb';
import { ObjectId } from 'mongodb';;;;
import { DatabaseService } from '../db/database.service.js';;
import type { Recipe } from '../types/express.js';
import { generatePDF, PDFGeneratorOptions } from '../utils/pdf-generator.js';;
import type { parseRecipeFromImage } from '../types/express.js';
import type { validateRecipe } from '../types/express.js';
import { sanitizeHtml } from '../utils/sanitizer.js';;
import { detectLanguage } from '../utils/language-detector.js';;
import logger from '../utils/logger.js';

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

export class ImportExportService {
  private static instance: ImportExportService;
  private db: DatabaseService;

  private constructor() {
    this.db = DatabaseService.getInstance();
  }

  public static getInstance(): ImportExportService {
    if (!ImportExportService.instance) {
      ImportExportService.instance = new ImportExportService();
    }
    return ImportExportService.instance;
  }

  /**
   * Import recipe from file
   */
  async importRecipe(
    userId: string,
    file: Express.Multer.File,
    format: string
  ): Promise<ImportResult> {
    try {
      let recipe: Partial<Recipe>;

      switch (format.toLowerCase()) {
        case 'json':
          recipe = this.parseJsonRecipe(file.buffer.toString());
          break;
        case 'image':
          recipe = await parseRecipeFromImage(file.path);
          break;
        default:
          throw new Error('Unsupported import format');
      }

      // Validate recipe
      const validationErrors = validateRecipe(recipe);
      if (validationErrors.length > 0) {
        return {
          success: false,
          errors: validationErrors.map(err => `${err.path.join('.')}: ${err.message}`),
        };
      }

      // Sanitize content
      if (recipe.description) {
        recipe.description = sanitizeHtml(recipe.description);
      }
      recipe.instructions = recipe.instructions?.map(instruction => ({
        ...instruction,
        text: sanitizeHtml(instruction.text),
      }));

      // Detect language if not specified
      if (!recipe.language) {
        const text = [
          recipe.title,
          recipe.description,
          ...(recipe.instructions?.map(i => i.text) || []),
        ].join(' ');
        const { language } = detectLanguage(text);
        recipe.language = language;
      }

      // Add required fields
      const validatedData: Recipe = {
        ...(recipe as Recipe),
        userId: new ObjectId(userId),
        title: recipe.title || 'Untitled Recipe',
        description: recipe.description || '',
        ingredients: recipe.ingredients || [],
        instructions: recipe.instructions || [],
        servings: recipe.servings || 1,
        prepTime: recipe.prepTime || 0,
        cookTime: recipe.cookTime || 0,
        totalTime: (recipe.prepTime || 0) + (recipe.cookTime || 0),
        difficulty: recipe.difficulty || 'medium',
        cuisine: recipe.cuisine || 'Other',
        tags: recipe.tags || [],
        images: recipe.images || [],
        author: {
          _id: new ObjectId(userId),
          name: 'Unknown',
        },
        ratings: {
          average: 0,
          count: 0,
        },
        stats: {
          viewCount: 0,
          saveCount: 0,
          rating: 0,
          likes: 0,
          shares: 0,
          comments: 0,
        },
        language: recipe.language || 'en',
        availableLanguages: [recipe.language || 'en'],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Insert recipe
      const result = await this.db.getCollection<Recipe>('recipes').insertOne(validatedData);

      return {
        success: true,
        recipeId: result.insertedId.toString(),
      };
    } catch (error) {
      logger.error('Recipe import failed:', error);
      return {
        success: false,
        errors: [(error as Error).message],
      };
    }
  }

  /**
   * Export recipes
   */
  async exportRecipes(recipeIds: string[], options: ExportOptions): Promise<Buffer> {
    const recipes = await this.db
      .getCollection<Recipe>('recipes')
      .find({ _id: { $in: recipeIds.map(id => new ObjectId(id)) } })
      .toArray();

    if (recipes.length === 0) {
      throw new Error('No recipes found to export');
    }

    switch (options.format) {
      case 'pdf':
        return generatePDF(recipes, {
          template: options.pdfTemplate,
          includeImages: options.includeImages,
          includeNutrition: options.includeNutrition,
          includeMetadata: options.includeMetadata,
        });

      case 'json':
        return Buffer.from(JSON.stringify(recipes, null, 2));

      case 'csv': {
        const fields = [
          'title',
          'description',
          'servings',
          'prepTime',
          'cookTime',
          'difficulty',
          'cuisine',
        ];
        const csvData = recipes.map(recipe => ({
          title: recipe.title,
          description: recipe.description,
          servings: recipe.servings,
          prepTime: recipe.prepTime,
          cookTime: recipe.cookTime,
          difficulty: recipe.difficulty,
          cuisine: recipe.cuisine,
        }));
        return Buffer.from(JSON.stringify(csvData));
      }

      default:
        throw new Error('Unsupported export format');
    }
  }

  private parseJsonRecipe(json: string): Partial<Recipe> {
    try {
      return JSON.parse(json);
    } catch (error) {
      throw new Error('Invalid JSON format');
    }
  }
}

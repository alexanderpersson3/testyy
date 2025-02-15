import { ObjectId } from 'mongodb';
import type { Recipe, CreateRecipeDTO } from '../types/recipe.js';
import type { MongoFilter, MongoUpdate } from '../types/mongodb.js';
import { MongoWriteError, MongoQueryError } from '../types/mongodb-errors.js';
import { ValidationError } from '../types/validation-errors.js';
import { DatabaseService } from '../db/database.service.js';
import { RecipeService } from '../services/recipe.service.js';
import { isObjectId } from '../types/mongodb.js';
import logger from '../utils/logger.js';
import { RecipeParserUtils } from '../utils/recipe-parser.utils.js';

// Add new error types
export class ImportError extends Error {
  constructor(message: string, public readonly details?: unknown) {
    super(message);
    this.name = 'ImportError';
  }
}

export class ParseError extends ImportError {
  constructor(message: string, public readonly line?: number, details?: unknown) {
    super(`Parse error${line ? ` at line ${line}` : ''}: ${message}`, details);
    this.name = 'ParseError';
  }
}

export class FormatError extends ImportError {
  constructor(message: string, details?: unknown) {
    super(`Format error: ${message}`, details);
    this.name = 'FormatError';
  }
}

export type ImportFormat = 'json' | 'csv' | 'txt';

export interface ImportOptions {
  format: ImportFormat;
  skipDuplicates?: boolean;
  updateExisting?: boolean;
  defaultPrivacy?: 'public' | 'private';
  defaultTags?: string[];
  validateOnly?: boolean;
}

export interface ImportResult {
  total: number;
  imported: number;
  skipped: number;
  updated: number;
  failed: number;
  errors: Array<{
    line: number;
    error: string;
  }>;
}

export interface ImportServiceInterface {
  importRecipes(content: string, options: ImportOptions): Promise<ImportResult>;
  validateImport(content: string, format: ImportFormat): Promise<ImportResult>;
}

/**
 * Service for importing recipes from various file formats.
 * Supports JSON, CSV, and plain text formats with validation and error handling.
 */
export class ImportService implements ImportServiceInterface {
  private static instance: ImportService;
  private db: DatabaseService;
  private recipeService: RecipeService;
  private initialized: boolean = false;

  private constructor() {
    this.db = DatabaseService.getInstance();
    this.recipeService = RecipeService.getInstance();
    this.initialize().catch(error => {
      logger.error('Failed to initialize ImportService:', error);
    });
  }

  /**
   * Gets the singleton instance of ImportService.
   * @returns The ImportService instance
   */
  static getInstance(): ImportService {
    if (!ImportService.instance) {
      ImportService.instance = new ImportService();
    }
    return ImportService.instance;
  }

  private async initialize() {
    if (this.initialized) return;

    try {
      await this.db.connect();
      this.initialized = true;
    } catch (error) {
      logger.error('Failed to initialize ImportService:', error);
      throw new MongoQueryError('Failed to initialize ImportService', error);
    }
  }

  private async ensureInitialized() {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  /**
   * Imports recipes from a string content in specified format.
   * @param content - String content containing recipe data
   * @param options - Import options including format and behavior flags
   * @returns Promise resolving to import results
   * @throws {ImportError} If import process fails
   * @throws {FormatError} If content format is invalid
   */
  async importRecipes(content: string, options: ImportOptions): Promise<ImportResult> {
    try {
      await this.ensureInitialized();

      if (!content) {
        throw new ValidationError('No content provided');
      }

      const result: ImportResult = {
        total: 0,
        imported: 0,
        skipped: 0,
        updated: 0,
        failed: 0,
        errors: []
      };

      const recipes = await this.parseRecipes(content, options.format, options);
      result.total = recipes.length;

      if (options.validateOnly) {
        return result;
      }

      for (let i = 0; i < recipes.length; i++) {
        try {
          const recipe = recipes[i];

          // Check for duplicates if needed
          if (options.skipDuplicates || options.updateExisting) {
            const existing = await this.recipeService.findRecipeByTitle(recipe.title);

            if (existing) {
              if (options.skipDuplicates) {
                result.skipped++;
                continue;
              }

              if (options.updateExisting) {
                await this.recipeService.updateRecipe(existing._id, {
                  ...recipe
                });
                result.updated++;
                continue;
              }
            }
          }

          // Create new recipe
          await this.recipeService.createRecipe(recipe);
          result.imported++;
        } catch (error) {
          result.failed++;
          result.errors.push({
            line: i + 1,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      return result;
    } catch (error) {
      if (error instanceof ValidationError) throw error;
      logger.error('Failed to import recipes:', error);
      throw new MongoWriteError('Failed to import recipes', error);
    }
  }

  /**
   * Validates recipe import content without performing the import.
   * @param content - String content to validate
   * @param format - Expected format of the content
   * @returns Promise resolving to validation results
   * @throws {ImportError} If validation fails
   */
  async validateImport(content: string, format: ImportFormat): Promise<ImportResult> {
    return this.importRecipes(content, { format, validateOnly: true });
  }

  /**
   * Parses recipes from content string based on format.
   * @param content - String content to parse
   * @param format - Format of the content
   * @param options - Import options
   * @returns Promise resolving to array of parsed recipes
   * @throws {FormatError} If content format is invalid
   * @throws {ParseError} If parsing fails
   * @private
   */
  private async parseRecipes(
    content: string,
    format: ImportFormat,
    options: ImportOptions
  ): Promise<CreateRecipeDTO[]> {
    const recipes: CreateRecipeDTO[] = [];
    const errors: Array<{ line: number; error: string }> = [];

    try {
      switch (format) {
        case 'json':
          try {
            const parsed = JSON.parse(content);
            if (Array.isArray(parsed)) {
              recipes.push(...this.validateRecipes(parsed));
            } else if (typeof parsed === 'object' && parsed !== null) {
              recipes.push(...this.validateRecipes([parsed]));
            } else {
              throw new FormatError('Invalid JSON format: expected object or array');
            }
          } catch (error) {
            if (error instanceof SyntaxError) {
              throw new ParseError('Invalid JSON syntax', undefined, error);
            }
            throw error;
          }
          break;

        case 'csv':
          const lines = content.split('\n').filter(line => line.trim());
          if (lines.length < 2) {
            throw new FormatError('CSV must contain at least a header row and one data row');
          }

          const headers = RecipeParserUtils.validateCSVHeaders(lines[0].split(',').map(h => h.trim().toLowerCase()));
          for (let i = 1; i < lines.length; i++) {
            try {
              const values = RecipeParserUtils.parseCSVLine(lines[i]);
              const recipe = RecipeParserUtils.parseCSVToRecipe(headers, values);
              recipes.push(recipe);
            } catch (error) {
              if (error instanceof ParseError || error instanceof ValidationError) {
                errors.push({ line: i + 1, error: error.message });
              } else {
                throw error;
              }
            }
          }
          break;

        case 'txt':
          const recipeTexts = content.split('\n\n').filter(text => text.trim());
          for (let i = 0; i < recipeTexts.length; i++) {
            try {
              const recipe = this.parseRecipeText(recipeTexts[i]);
              recipes.push(recipe);
            } catch (error) {
              if (error instanceof ParseError || error instanceof ValidationError) {
                errors.push({ line: i + 1, error: error.message });
              } else {
                throw error;
              }
            }
          }
          break;

        default:
          throw new FormatError(`Unsupported format: ${format}`);
      }

      // Apply default options
      recipes.forEach(recipe => {
        if (options.defaultTags) {
          recipe.tags = [...new Set([...(recipe.tags || []), ...options.defaultTags])];
        }
      });

      if (errors.length > 0) {
        throw new ImportError('Failed to parse some recipes', { errors });
      }

      return recipes;
    } catch (error) {
      if (error instanceof ImportError) throw error;
      logger.error('Failed to parse recipes:', error);
      throw new ImportError('Failed to parse recipes', error);
    }
  }

  /**
   * Validates an array of potential recipes.
   * @param recipes - Array of unknown objects to validate as recipes
   * @returns Array of validated recipes
   * @throws {ParseError} If validation fails
   * @private
   */
  private validateRecipes(recipes: unknown[]): CreateRecipeDTO[] {
    return recipes.map((recipe, index) => {
      if (!recipe || typeof recipe !== 'object') {
        throw new ParseError('Recipe must be an object', index + 1);
      }

      const validatedRecipe = recipe as Partial<CreateRecipeDTO>;
      
      if (!validatedRecipe.title) {
        throw new ValidationError('Recipe title is required', index + 1);
      }

      if (!Array.isArray(validatedRecipe.ingredients) || validatedRecipe.ingredients.length === 0) {
        throw new ValidationError('Recipe must have at least one ingredient', index + 1);
      }

      if (!Array.isArray(validatedRecipe.instructions) || validatedRecipe.instructions.length === 0) {
        throw new ValidationError('Recipe must have at least one instruction', index + 1);
      }

      return validatedRecipe as CreateRecipeDTO;
    });
  }

  private parseRecipeText(text: string): CreateRecipeDTO {
    const lines = text.split('\n').map(line => line.trim());
    const recipe: Partial<CreateRecipeDTO> = {
      ingredients: [],
      instructions: [],
      tags: []
    };

    let currentSection: 'ingredients' | 'instructions' | null = null;

    for (const line of lines) {
      if (!line) continue;

      if (line.toLowerCase().includes('ingredients:')) {
        currentSection = 'ingredients';
        continue;
      }
      if (line.toLowerCase().includes('instructions:')) {
        currentSection = 'instructions';
        continue;
      }

      if (!recipe.title) {
        recipe.title = line;
        continue;
      }

      if (!recipe.description) {
        recipe.description = line;
        continue;
      }

      if (currentSection === 'ingredients') {
        const ingredients = RecipeParserUtils.parseIngredients([line]);
        if (ingredients.length > 0) {
          recipe.ingredients!.push(ingredients[0]);
        }
      } else if (currentSection === 'instructions') {
        const instructions = RecipeParserUtils.parseInstructions([line]);
        if (instructions.length > 0) {
          recipe.instructions!.push(instructions[0]);
        }
      }
    }

    if (!recipe.title) {
      throw new ValidationError('Recipe title is required');
    }

    if (!recipe.ingredients?.length) {
      throw new ValidationError('Recipe must have at least one ingredient');
    }

    if (!recipe.instructions?.length) {
      throw new ValidationError('Recipe must have at least one instruction');
    }

    return {
      ...recipe,
      servings: 4,
      prepTime: 15,
      cookTime: 30,
      difficulty: 'medium',
      tags: []
    } as CreateRecipeDTO;
  }
}

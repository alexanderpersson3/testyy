import type { Recipe, CreateRecipeDTO } from '../types/recipe.js';
import { ValidationError } from '../types/validation-errors.js';

/**
 * Utility class for parsing recipe-related content
 */
export class RecipeParserUtils {
  /**
   * Parses ingredients from text lines
   * @param lines - Array of text lines containing ingredient information
   * @returns Array of parsed recipe ingredients
   */
  static parseIngredients(lines: string[]): Recipe['ingredients'] {
    return lines
      .map(line => {
        const match = line.match(/^([\d.\/]+)?\s*(\w+)?\s+(.+)$/);
        if (!match) return null;

        const [, amount, unit, name] = match;
        return {
          name: name.trim(),
          amount: parseFloat(amount) || 1,
          unit: unit?.trim() || 'piece',
        };
      })
      .filter((ingredient): ingredient is Recipe['ingredients'][number] => ingredient !== null);
  }

  /**
   * Parses instructions from text lines
   * @param lines - Array of text lines containing instruction information
   * @returns Array of parsed recipe instructions
   */
  static parseInstructions(lines: string[]): Recipe['instructions'] {
    return lines
      .map((line, index) => {
        const text = line.replace(/^\d+\.\s*/, '').trim();
        if (!text) return null;

        // Try to extract timer information
        const timerMatch = text.match(/(\d+)\s*(minutes?|hours?)/i);
        const timer = timerMatch ? {
          duration: parseInt(timerMatch[1], 10),
          unit: timerMatch[2].toLowerCase().startsWith('hour') ? 'hours' : 'minutes'
        } : undefined;

        return {
          step: index + 1,
          text,
          ...(timer && { timer })
        };
      })
      .filter((instruction): instruction is Recipe['instructions'][number] => instruction !== null);
  }

  /**
   * Parses CSV content into recipe data
   * @param headers - Array of CSV headers
   * @param values - Array of CSV values
   * @returns Parsed recipe data
   * @throws {ValidationError} If required fields are missing
   */
  static parseCSVToRecipe(headers: string[], values: string[]): CreateRecipeDTO {
    if (headers.length !== values.length) {
      throw new ValidationError('CSV row has incorrect number of columns');
    }

    const recipe: Partial<CreateRecipeDTO> = {};

    headers.forEach((header, index) => {
      const value = values[index];
      switch (header.toLowerCase()) {
        case 'title':
          recipe.title = value;
          break;
        case 'description':
          recipe.description = value;
          break;
        case 'ingredients':
          recipe.ingredients = value.split(';').map(ing => {
            const [amount, unit, name] = ing.split('|');
            return {
              name: name.trim(),
              amount: parseFloat(amount),
              unit: unit.trim()
            };
          });
          break;
        case 'instructions':
          recipe.instructions = value.split(';').map((text, step) => ({
            step: step + 1,
            text: text.trim()
          }));
          break;
        case 'servings':
          recipe.servings = parseInt(value, 10);
          break;
        case 'preptime':
          recipe.prepTime = parseInt(value, 10);
          break;
        case 'cooktime':
          recipe.cookTime = parseInt(value, 10);
          break;
        case 'difficulty':
          recipe.difficulty = value as Recipe['difficulty'];
          break;
        case 'cuisine':
          recipe.cuisine = value;
          break;
        case 'tags':
          recipe.tags = value.split(';').map(tag => tag.trim());
          break;
      }
    });

    if (!recipe.title) {
      throw new ValidationError('Recipe title is required');
    }

    return recipe as CreateRecipeDTO;
  }

  /**
   * Parses CSV line considering quoted values
   * @param line - CSV line to parse
   * @returns Array of parsed values
   */
  static parseCSVLine(line: string): string[] {
    const values: string[] = [];
    let currentValue = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(currentValue.trim());
        currentValue = '';
      } else {
        currentValue += char;
      }
    }
    values.push(currentValue.trim());

    return values;
  }

  /**
   * Validates CSV headers
   * @param headers - Array of header names
   * @returns Validated headers
   * @throws {ValidationError} If required headers are missing
   */
  static validateCSVHeaders(headers: string[]): string[] {
    const requiredHeaders = ['title', 'ingredients', 'instructions'];
    const missingHeaders = requiredHeaders.filter(h => !headers.includes(h.toLowerCase()));

    if (missingHeaders.length > 0) {
      throw new ValidationError(`Missing required CSV headers: ${missingHeaders.join(', ')}`);
    }

    return headers;
  }
} 
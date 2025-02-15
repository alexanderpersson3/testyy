import type { Recipe } from '../types/express.js';

export interface SanitizeOptions {
  stripHtml?: boolean;
  normalizeText?: boolean;
  maxLength?: {
    title?: number;
    description?: number;
    instruction?: number;
  };
}

const defaultOptions: SanitizeOptions = {
  stripHtml: true,
  normalizeText: true,
  maxLength: {
    title: 200,
    description: 2000,
    instruction: 1000,
  },
};

export function sanitizeRecipe(recipe: Recipe, options: SanitizeOptions = {}): Recipe {
  const opts = { ...defaultOptions, ...options };

  return {
    ...recipe,
    title: sanitizeText(recipe.title, opts.maxLength?.title),
    description: sanitizeText(recipe.description, opts.maxLength?.description),
    ingredients: recipe.ingredients.map(ingredient => ({
      ...ingredient,
      name: sanitizeText(ingredient.name),
      notes: ingredient.notes ? sanitizeText(ingredient.notes) : undefined,
    })),
    instructions: recipe.instructions.map(instruction => ({
      ...instruction,
      text: sanitizeText(instruction.text, opts.maxLength?.instruction),
    })),
  };
}

function sanitizeText(text: string, maxLength?: number): string {
  if (!text) return '';

  let sanitized = text;

  // Strip HTML if enabled
  sanitized = sanitized.replace(/<[^>]*>/g, '');

  // Normalize whitespace
  sanitized = sanitized.replace(/\s+/g, ' ').trim();

  // Truncate if maxLength is specified
  if (maxLength && sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength).trim();
  }

  return sanitized;
}

import type { Recipe } from '../types/express.js';
import type { RecipeIngredient, RecipeInstruction, UserDocument } from '../types/express.js';
import { Difficulty } from '../types/express.js';;
import { ObjectId } from 'mongodb';;;;
import logger from '../utils/logger.js';

export class ValidationError extends Error {
  constructor(
    public override readonly message: string,
    public readonly code: string,
    public readonly field?: string
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

export interface ParsedRecipe {
  title: string;
  description?: string;
  ingredients: RecipeIngredient[];
  instructions: RecipeInstruction[];
  servings?: number;
  prepTime?: number;
  cookTime?: number;
  totalTime?: number;
  difficulty?: Difficulty;
  cuisine?: string;
  tags?: string[];
  source?: string;
  sourceUrl?: string;
  confidence: number;
}

export interface ParserOptions {
  extractTimes?: boolean;
  extractTags?: boolean;
  language?: string;
  minConfidence?: number;
}

export interface ParseError extends Error {
  code: string;
  details?: Record<string, unknown>;
}

export interface ParseResult {
  recipe: ParsedRecipe;
  warnings: string[];
}

export async function parseRecipe(
  content: string,
  options: ParserOptions = {}
): Promise<ParseResult> {
  const warnings: string[] = [];

  try {
    // Basic structure for recipe parsing
    const recipe: ParsedRecipe = {
      title: extractTitle(content),
      description: extractDescription(content),
      ingredients: extractIngredients(content),
      instructions: extractInstructions(content),
      confidence: calculateConfidence(content),
    };

    if (options.extractTimes) {
      const times = extractTimes(content);
      recipe.prepTime = times.prepTime;
      recipe.cookTime = times.cookTime;
      recipe.totalTime = times.totalTime;

      if (!times.prepTime && !times.cookTime) {
        warnings.push('Could not extract preparation or cooking times');
      }
    }

    if (options.extractTags) {
      recipe.tags = extractTags(content);
      if (!recipe.tags.length) {
        warnings.push('No tags could be extracted');
      }
    }

    // Validate confidence threshold
    if (options.minConfidence && recipe.confidence < options.minConfidence) {
      throw new ValidationError('Recipe parsing confidence below threshold', 'PARSE_FAILED', 'confidence');
    }

    return { recipe, warnings };
  } catch (error) {
    logger.error('Failed to parse recipe:', error);
    if (error instanceof ValidationError) {
      throw error;
    }
    throw createParseError('PARSE_FAILED', 'Recipe parsing failed', { error });
  }
}

function extractTitle(content: string): string {
  if (!content.trim()) {
    throw createParseError('EMPTY_CONTENT', 'Content is empty');
  }
  const lines = content.split('\n');
  const title = lines[0]?.trim();
  if (!title) {
    throw createParseError('NO_TITLE', 'Could not extract title');
  }
  return title;
}

function extractDescription(content: string): string {
  const lines = content.split('\n').filter(line => line.trim());
  return lines[1]?.trim() || '';
}

function extractIngredients(content: string): RecipeIngredient[] {
  const ingredients: RecipeIngredient[] = [];
  const lines = content.split('\n');

  let inIngredientsSection = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (trimmed.toLowerCase().includes('ingredients')) {
      inIngredientsSection = true;
      continue;
    }

    if (inIngredientsSection && trimmed.toLowerCase().includes('instructions')) {
      break;
    }

    if (inIngredientsSection) {
      const ingredient = parseIngredientLine(trimmed);
      if (ingredient) {
        ingredients.push(ingredient);
      }
    }
  }

  return ingredients;
}

function parseIngredientLine(line: string): RecipeIngredient | null {
  // Basic ingredient line parser
  const match = line.match(/^([\d.\/]+)?\s*(\w+)?\s+(.+)$/);
  if (!match) return null;

  const [, amount, unit, name] = match;
  return {
    name: name.trim(),
    amount: parseFloat(amount) || 1,
    unit: unit?.trim() || 'piece',
  };
}

function extractInstructions(content: string): RecipeInstruction[] {
  const instructions: RecipeInstruction[] = [];
  const lines = content.split('\n');

  let inInstructionsSection = false;
  let step = 1;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (trimmed.toLowerCase().includes('instructions')) {
      inInstructionsSection = true;
      continue;
    }

    if (inInstructionsSection) {
      instructions.push({
        step,
        text: trimmed,
      });
      step++;
    }
  }

  return instructions;
}

function extractTimes(content: string): {
  prepTime?: number;
  cookTime?: number;
  totalTime?: number;
} {
  const times: { prepTime?: number; cookTime?: number; totalTime?: number } = {};

  // Look for time patterns
  const prepMatch = content.match(/prep(?:aration)?\s*time:?\s*(\d+)/i);
  const cookMatch = content.match(/cook(?:ing)?\s*time:?\s*(\d+)/i);
  const totalMatch = content.match(/total\s*time:?\s*(\d+)/i);

  if (prepMatch) times.prepTime = parseInt(prepMatch[1], 10);
  if (cookMatch) times.cookTime = parseInt(cookMatch[1], 10);
  if (totalMatch) times.totalTime = parseInt(totalMatch[1], 10);

  return times;
}

function extractTags(content: string): string[] {
  const commonTags = ['vegetarian', 'vegan', 'gluten-free', 'dairy-free', 'quick', 'easy'];
  return commonTags.filter(tag => content.toLowerCase().includes(tag));
}

function calculateConfidence(content: string): number {
  let score = 0;

  // Check for required sections
  if (content.toLowerCase().includes('ingredients')) score += 0.3;
  if (content.toLowerCase().includes('instructions')) score += 0.3;

  // Check for optional sections
  if (content.toLowerCase().includes('prep time')) score += 0.1;
  if (content.toLowerCase().includes('cook time')) score += 0.1;
  if (content.toLowerCase().includes('servings')) score += 0.1;
  if (content.toLowerCase().includes('description')) score += 0.1;

  return Math.min(1, score);
}

export function validateParsedRecipe(recipe: ParsedRecipe): boolean {
  return (
    typeof recipe.title === 'string' &&
    recipe.title.length > 0 &&
    typeof recipe.description === 'string' &&
    Array.isArray(recipe.ingredients) &&
    recipe.ingredients.length > 0 &&
    Array.isArray(recipe.instructions) &&
    recipe.instructions.length > 0 &&
    recipe.confidence > 0
  );
}

export function convertToRecipe(parsed: ParsedRecipe): Omit<Recipe, '_id'> {
  if (!validateParsedRecipe(parsed)) {
    throw new ValidationError('Invalid parsed recipe', 'INVALID_RECIPE', 'parsed');
  }

  const now = new Date();

  return {
    title: parsed.title,
    description: parsed.description || '',
    ingredients: parsed.ingredients,
    instructions: parsed.instructions,
    servings: parsed.servings || 4,
    prepTime: parsed.prepTime || 0,
    cookTime: parsed.cookTime || 0,
    totalTime: parsed.totalTime || (parsed.prepTime || 0) + (parsed.cookTime || 0),
    difficulty: parsed.difficulty || Difficulty.Medium,
    cuisine: parsed.cuisine || '',
    tags: parsed.tags || [],
    images: [],
    author: {
      _id: new ObjectId(),
      email: 'system@rezepta.com',
      username: 'system',
      role: 'user',
      preferences: {
        language: 'en',
        theme: 'light',
        notifications: false
      }
    } as UserDocument,
    language: 'en',
    availableLanguages: ['en'],
    createdAt: now,
    updatedAt: now
  };
}

function createParseError(
  code: string,
  message: string,
  details?: Record<string, unknown>
): ParseError {
  const error = new Error(message) as ParseError;
  error.code = code;
  error.details = details;
  return error;
}

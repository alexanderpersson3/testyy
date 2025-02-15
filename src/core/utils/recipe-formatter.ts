import type { Recipe } from '../types/express.js';
import type { RecipeIngredient, RecipeInstruction } from '../types/express.js';
import type { ExportOptions } from '../types/express.js';
interface FormattedRecipe {
  title: string;
  description?: string;
  servings: number;
  prepTime: number;
  cookTime: number;
  totalTime: number;
  difficulty: string;
  ingredients: Array<{
    name: string;
    amount: number;
    unit: string;
  }>;
  instructions: Array<{
    step: number;
    text: string;
    duration?: number;
    temperature?: {
      value: number;
      unit: 'C' | 'F';
    };
  }>;
  tags?: string[];
  imageUrl?: string;
}

/**
 * Format a recipe for export
 */
export function formatRecipeForExport(recipe: Recipe, options: ExportOptions): FormattedRecipe {
  const formatted: FormattedRecipe = {
    title: recipe.title,
    description: recipe.description,
    servings: recipe.servings ?? 1,
    prepTime: recipe.prepTime ?? 0,
    cookTime: recipe.cookTime ?? 0,
    totalTime: recipe.totalTime ?? ((recipe.prepTime ?? 0) + (recipe.cookTime ?? 0)),
    difficulty: recipe.difficulty,
    ingredients: recipe.ingredients.map(ingredient => ({
      name: ingredient.name,
      amount: ingredient.amount,
      unit: ingredient.unit,
    })),
    instructions: recipe.instructions.map((instruction: any, index: any) => ({
      step: index + 1,
      text: instruction.text,
      ...(instruction.duration !== undefined && { duration: instruction.duration }),
      ...(instruction.temperature && { temperature: instruction.temperature }),
    })),
  };

  if (options.includeTags && recipe.tags?.length > 0) {
    formatted.tags = recipe.tags;
  }

  if (options.includeImages && recipe.images?.length > 0) {
    formatted.imageUrl = recipe.images[0];
  }

  return formatted;
}

export function formatRecipe(recipe: Recipe): Recipe {
  return {
    ...recipe,
    ingredients: recipe.ingredients.map((ingredient: RecipeIngredient) => ({
      ...ingredient,
      name: (ingredient.name ?? '').trim(),
      amount: Number(ingredient.amount ?? 0),
      unit: (ingredient.unit ?? '').trim()
    })),
    instructions: recipe.instructions.map((instruction: RecipeInstruction, index: number) => ({
      ...instruction,
      text: (instruction.text ?? '').trim(),
      step: index + 1
    }))
  };
}

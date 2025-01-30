import { Recipe } from './recipe.js';

export interface RecipeSearchResponse {
  hits: {
    total: number;
    hits: Array<{
      _id: string;
      _score: number;
      _source: Recipe;
    }>;
  };
}

export interface RecipeSuggestion {
  name: string;
  cuisine?: string;
  difficulty: 'easy' | 'medium' | 'hard';
  score: number;
}

export function isRecipeSource(source: any): source is Pick<Recipe, 'name' | 'cuisine' | 'difficulty'> {
  return (
    typeof source === 'object' &&
    source !== null &&
    typeof source.name === 'string' &&
    (source.cuisine === undefined || typeof source.cuisine === 'string') &&
    ['easy', 'medium', 'hard'].includes(source.difficulty)
  );
} 

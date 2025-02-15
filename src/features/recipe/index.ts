// Recipe Feature Module
export * from './controllers';
export * from './services';
export * from './repositories';
export * from './routes';
export * from './schemas';
export * from './types';

// Re-export commonly used types
export type {
  Recipe,
  Ingredient,
  Difficulty,
  RecipeStats,
  RecipeSearchParams,
  CreateRecipeDTO,
  UpdateRecipeDTO,
  RecipeLike,
  RecipeReport
} from './types/recipe.types.js';

// Re-export service singleton
export { recipeService } from './services/recipe.service.js';

// Re-export router
export { default as recipeRouter } from './routes/recipe.routes.js';

// Feature configuration
export const recipeFeatureConfig = {
  name: 'recipe',
  description: 'Recipe management and search functionality',
  version: '1.0.0',
  dependencies: ['user', 'ingredient']
}; 
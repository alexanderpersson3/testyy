export * from './controllers/recipe.controller.js';
export * from './services/recipe.service.js';
export * from './repositories/recipe.repository.js';
export * from './routes/recipe.routes.js';
export * from './schemas/recipe.schema.js';
export * from './types/recipe.types.js';

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
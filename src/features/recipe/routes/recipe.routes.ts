import { Router } from 'express';
import { RecipeController } from '../controllers/recipe.controller.js';
import { authenticate } from '../../../core/middleware/auth.middleware.js';
import { validateRequest } from '../../../core/middleware/validate.middleware.js';
import { 
  createRecipeSchema, 
  updateRecipeSchema, 
  rateRecipeSchema,
  reportRecipeSchema,
  getRecipesSchema,
  findRecipeByTitleSchema,
  getRecipeLikesSchema
} from '../schemas/recipe.schema.js';

const router = Router();
const controller = new RecipeController();

// Public routes
router.get('/search', controller.searchRecipes.bind(controller));
router.get('/popular', controller.getPopularRecipes.bind(controller));
router.get('/recent', controller.getRecentRecipes.bind(controller));
router.get('/stats', controller.getRecipeStats.bind(controller));
router.get('/cuisine/:cuisine', controller.getRecipesByCuisine.bind(controller));
router.get('/difficulty/:difficulty', controller.getRecipesByDifficulty.bind(controller));
router.get('/tags', controller.getRecipesByTags.bind(controller));
router.get('/bulk', validateRequest(getRecipesSchema), controller.getRecipes.bind(controller));
router.get('/title', validateRequest(findRecipeByTitleSchema), controller.findRecipeByTitle.bind(controller));
router.get('/:id', controller.getRecipe.bind(controller));
router.get('/:id/similar', controller.getSimilarRecipes.bind(controller));
router.get('/:id/likes', validateRequest(getRecipeLikesSchema), controller.getRecipeLikes.bind(controller));
router.get('/author/:authorId', controller.getRecipesByAuthor.bind(controller));

// Protected routes
router.post('/',
  authenticate,
  validateRequest(createRecipeSchema),
  controller.createRecipe.bind(controller)
);

router.put('/:id',
  authenticate,
  validateRequest(updateRecipeSchema),
  controller.updateRecipe.bind(controller)
);

router.delete('/:id',
  authenticate,
  controller.deleteRecipe.bind(controller)
);

router.post('/:id/rate',
  authenticate,
  validateRequest(rateRecipeSchema),
  controller.rateRecipe.bind(controller)
);

router.post('/:id/like',
  authenticate,
  controller.toggleLike.bind(controller)
);

router.post('/:id/report',
  authenticate,
  validateRequest(reportRecipeSchema),
  controller.reportRecipe.bind(controller)
);

export default router; 
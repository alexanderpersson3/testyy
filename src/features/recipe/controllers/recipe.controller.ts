import { Request, Response } from 'express';
import { ObjectId } from 'mongodb';
import { RecipeService } from '../services/recipe.service.js';
import { NotFoundError } from '../../../core/errors/not-found.error.js';
import { ValidationError } from '../../../core/errors/validation.error.js';
import { MongoQueryError, MongoWriteError } from '../../../core/errors/mongodb.errors.js';
import type { Recipe } from '../types/recipe.types.js';

export class RecipeController {
  private service: RecipeService;

  constructor() {
    this.service = RecipeService.getInstance();
  }

  /**
   * Create recipe
   */
  async createRecipe(req: Request, res: Response): Promise<void> {
    try {
      const recipe = await this.service.createRecipe(req.body);
      res.status(201).json(recipe);
    } catch (error) {
      if (error instanceof ValidationError) {
        res.status(400).json({ message: error.message, details: error.details });
      } else if (error instanceof MongoWriteError) {
        res.status(500).json({ message: 'Failed to create recipe' });
      } else {
        throw error;
      }
    }
  }

  /**
   * Get recipe by ID
   */
  async getRecipe(req: Request, res: Response): Promise<void> {
    try {
      const recipe = await this.service.getRecipe(new ObjectId(req.params.id));
      res.json(recipe);
    } catch (error) {
      if (error instanceof NotFoundError) {
        res.status(404).json({ message: error.message });
      } else if (error instanceof ValidationError) {
        res.status(400).json({ message: 'Invalid recipe ID format' });
      } else if (error instanceof MongoQueryError) {
        res.status(500).json({ message: 'Failed to fetch recipe' });
      } else {
        throw error;
      }
    }
  }

  /**
   * Update recipe
   */
  async updateRecipe(req: Request, res: Response): Promise<void> {
    try {
      const recipe = await this.service.updateRecipe(
        new ObjectId(req.params.id),
        req.body
      );
      res.json(recipe);
    } catch (error) {
      if (error instanceof NotFoundError) {
        res.status(404).json({ message: error.message });
      } else if (error instanceof ValidationError) {
        res.status(400).json({ message: error.message, details: error.details });
      } else if (error instanceof MongoWriteError) {
        res.status(500).json({ message: 'Failed to update recipe' });
      } else {
        throw error;
      }
    }
  }

  /**
   * Delete recipe
   */
  async deleteRecipe(req: Request, res: Response): Promise<void> {
    try {
      await this.service.deleteRecipe(new ObjectId(req.params.id));
      res.status(204).send();
    } catch (error) {
      if (error instanceof NotFoundError) {
        res.status(404).json({ message: error.message });
      } else if (error instanceof ValidationError) {
        res.status(400).json({ message: 'Invalid recipe ID format' });
      } else if (error instanceof MongoWriteError) {
        res.status(500).json({ message: 'Failed to delete recipe' });
      } else {
        throw error;
      }
    }
  }

  /**
   * Search recipes
   */
  async searchRecipes(req: Request, res: Response): Promise<void> {
    try {
      const recipes = await this.service.searchRecipes(req.query);
      res.json(recipes);
    } catch (error) {
      if (error instanceof MongoQueryError) {
        res.status(500).json({ message: 'Failed to search recipes' });
      } else {
        throw error;
      }
    }
  }

  /**
   * Get recipes by author
   */
  async getRecipesByAuthor(req: Request, res: Response): Promise<void> {
    try {
      const recipes = await this.service.getRecipesByAuthor(
        new ObjectId(req.params.authorId)
      );
      res.json(recipes);
    } catch (error) {
      if (error instanceof ValidationError) {
        res.status(400).json({ message: 'Invalid author ID format' });
      } else if (error instanceof MongoQueryError) {
        res.status(500).json({ message: 'Failed to fetch recipes' });
      } else {
        throw error;
      }
    }
  }

  /**
   * Get recipes by cuisine
   */
  async getRecipesByCuisine(req: Request, res: Response): Promise<void> {
    try {
      const recipes = await this.service.searchRecipes({
        cuisine: req.params.cuisine
      });
      res.json(recipes);
    } catch (error) {
      if (error instanceof MongoQueryError) {
        res.status(500).json({ message: 'Failed to fetch recipes' });
      } else {
        throw error;
      }
    }
  }

  /**
   * Get recipes by difficulty
   */
  async getRecipesByDifficulty(req: Request, res: Response): Promise<void> {
    try {
      const recipes = await this.service.searchRecipes({
        difficulty: req.params.difficulty
      });
      res.json(recipes);
    } catch (error) {
      if (error instanceof MongoQueryError) {
        res.status(500).json({ message: 'Failed to fetch recipes' });
      } else {
        throw error;
      }
    }
  }

  /**
   * Get recipes by tags
   */
  async getRecipesByTags(req: Request, res: Response): Promise<void> {
    try {
      const tags = Array.isArray(req.query.tags)
        ? req.query.tags as string[]
        : [req.query.tags as string];
      const recipes = await this.service.getRecipesByTags(tags);
      res.json(recipes);
    } catch (error) {
      if (error instanceof MongoQueryError) {
        res.status(500).json({ message: 'Failed to fetch recipes' });
      } else {
        throw error;
      }
    }
  }

  /**
   * Get popular recipes
   */
  async getPopularRecipes(req: Request, res: Response): Promise<void> {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
      const recipes = await this.service.getPopularRecipes(limit);
      res.json(recipes);
    } catch (error) {
      if (error instanceof MongoQueryError) {
        res.status(500).json({ message: 'Failed to fetch popular recipes' });
      } else {
        throw error;
      }
    }
  }

  /**
   * Get recent recipes
   */
  async getRecentRecipes(req: Request, res: Response): Promise<void> {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
      const recipes = await this.service.searchRecipes({
        sortBy: 'createdAt',
        limit
      });
      res.json(recipes);
    } catch (error) {
      if (error instanceof MongoQueryError) {
        res.status(500).json({ message: 'Failed to fetch recent recipes' });
      } else {
        throw error;
      }
    }
  }

  /**
   * Get similar recipes
   */
  async getSimilarRecipes(req: Request, res: Response): Promise<void> {
    try {
      const recipe = await this.service.getRecipe(new ObjectId(req.params.id));
      const recipes = await this.service.searchRecipes({
        $or: [
          { cuisine: recipe.cuisine },
          { tags: { $in: recipe.tags } },
          { difficulty: recipe.difficulty }
        ]
      });
      res.json(recipes.filter(r => r._id.toString() !== req.params.id));
    } catch (error) {
      if (error instanceof NotFoundError) {
        res.status(404).json({ message: error.message });
      } else if (error instanceof ValidationError) {
        res.status(400).json({ message: 'Invalid recipe ID format' });
      } else if (error instanceof MongoQueryError) {
        res.status(500).json({ message: 'Failed to fetch similar recipes' });
      } else {
        throw error;
      }
    }
  }

  /**
   * Rate recipe
   */
  async rateRecipe(req: Request, res: Response): Promise<void> {
    try {
      await this.service.updateRating(
        new ObjectId(req.params.id),
        req.body.rating
      );
      const recipe = await this.service.getRecipe(new ObjectId(req.params.id));
      res.json(recipe);
    } catch (error) {
      if (error instanceof NotFoundError) {
        res.status(404).json({ message: error.message });
      } else if (error instanceof ValidationError) {
        res.status(400).json({ message: error.message });
      } else if (error instanceof MongoWriteError) {
        res.status(500).json({ message: 'Failed to rate recipe' });
      } else {
        throw error;
      }
    }
  }

  /**
   * Get recipe stats
   */
  async getRecipeStats(req: Request, res: Response): Promise<void> {
    try {
      const stats = await this.service.getStats();
      res.json(stats);
    } catch (error) {
      if (error instanceof MongoQueryError) {
        res.status(500).json({ message: 'Failed to fetch recipe statistics' });
      } else {
        throw error;
      }
    }
  }

  /**
   * Get multiple recipes by IDs
   */
  async getRecipes(req: Request, res: Response): Promise<void> {
    try {
      const recipeIds = (req.query.ids as string[]).map(id => new ObjectId(id));
      const recipes = await this.service.getRecipes(recipeIds);
      res.json(recipes);
    } catch (error) {
      if (error instanceof ValidationError) {
        res.status(400).json({ message: 'Invalid recipe ID format in list' });
      } else if (error instanceof MongoQueryError) {
        res.status(500).json({ message: 'Failed to fetch recipes' });
      } else {
        throw error;
      }
    }
  }

  /**
   * Find recipe by exact title
   */
  async findRecipeByTitle(req: Request, res: Response): Promise<void> {
    try {
      const recipe = await this.service.findRecipeByTitle(req.query.title as string);
      if (!recipe) {
        res.status(404).json({ message: 'Recipe not found' });
      } else {
        res.json(recipe);
      }
    } catch (error) {
      if (error instanceof MongoQueryError) {
        res.status(500).json({ message: 'Failed to find recipe' });
      } else {
        throw error;
      }
    }
  }

  /**
   * Toggle recipe like status
   */
  async toggleLike(req: Request, res: Response): Promise<void> {
    try {
      const isLiked = await this.service.toggleLike(
        new ObjectId(req.params.id),
        new ObjectId(req.user!._id)
      );
      res.json({ liked: isLiked });
    } catch (error) {
      if (error instanceof ValidationError) {
        res.status(400).json({ message: 'Invalid recipe ID format' });
      } else if (error instanceof MongoWriteError) {
        res.status(500).json({ message: 'Failed to toggle recipe like' });
      } else {
        throw error;
      }
    }
  }

  /**
   * Get recipe likes
   */
  async getRecipeLikes(req: Request, res: Response): Promise<void> {
    try {
      const { likes, total } = await this.service.getRecipeLikes(
        new ObjectId(req.params.id),
        {
          page: req.query.page ? parseInt(req.query.page as string, 10) : undefined,
          limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
          includeUser: req.query.includeUser === 'true',
          excludeFields: req.query.excludeFields ? (req.query.excludeFields as string).split(',') : undefined
        }
      );
      res.json({ likes, total });
    } catch (error) {
      if (error instanceof ValidationError) {
        res.status(400).json({ message: 'Invalid recipe ID format' });
      } else if (error instanceof MongoQueryError) {
        res.status(500).json({ message: 'Failed to fetch recipe likes' });
      } else {
        throw error;
      }
    }
  }

  /**
   * Report a recipe
   */
  async reportRecipe(req: Request, res: Response): Promise<void> {
    try {
      await this.service.reportRecipe(
        new ObjectId(req.params.id),
        new ObjectId(req.user!._id),
        {
          reason: req.body.reason,
          description: req.body.description
        }
      );
      res.status(204).send();
    } catch (error) {
      if (error instanceof ValidationError) {
        res.status(400).json({ message: error.message });
      } else if (error instanceof MongoWriteError) {
        res.status(500).json({ message: 'Failed to report recipe' });
      } else {
        throw error;
      }
    }
  }
} 
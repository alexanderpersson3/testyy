import express, { Request, Response } from 'express';
import { check, validationResult } from 'express-validator';
import { ObjectId } from 'mongodb';

import { auth } from '../middleware/auth.js';
import { connectToDatabase } from '../db/db.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AuthenticatedRequest } from '../types/auth.js';
import { RecipeCategory, RecipeCollection } from '../types/recipe.js';

const router = express.Router();

type AsyncRequestHandler = (req: AuthenticatedRequest, res: Response) => Promise<Response | void>;

// Get all categories
router.get('/', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = await connectToDatabase();
    const categories = await db.collection<RecipeCategory>('recipe_categories')
      .find({ isActive: true })
      .sort({ order: 1 })
      .toArray();

    return res.json({
      success: true,
      data: categories
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: {
        code: 'CATEGORIES_FETCH_ERROR',
        message: error instanceof Error ? error.message : 'Error fetching categories'
      }
    });
  }
}));

// Create category (admin only)
router.post('/',
  auth,
  [
    check('name').trim().notEmpty(),
    check('slug').trim().notEmpty(),
    check('description').optional().trim(),
    check('parentId').optional().isMongoId(),
    check('order').optional().isInt({ min: 0 }),
    check('isActive').optional().isBoolean()
  ],
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    try {
      // TODO: Add admin check
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid input data',
            details: errors.array()
          }
        });
      }

      const db = await connectToDatabase();

      // Check if slug is unique
      const existingCategory = await db.collection('recipe_categories').findOne({
        slug: req.body.slug
      });

      if (existingCategory) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'DUPLICATE_SLUG',
            message: 'Category slug must be unique'
          }
        });
      }

      const category: Omit<RecipeCategory, '_id'> = {
        name: req.body.name,
        slug: req.body.slug,
        description: req.body.description,
        parentId: req.body.parentId ? new ObjectId(req.body.parentId) : undefined,
        order: req.body.order || 0,
        isActive: req.body.isActive ?? true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const result = await db.collection<RecipeCategory>('recipe_categories').insertOne(category);

      return res.status(201).json({
        success: true,
        data: {
          categoryId: result.insertedId
        }
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: {
          code: 'CATEGORY_CREATE_ERROR',
          message: error instanceof Error ? error.message : 'Error creating category'
        }
      });
    }
  })
);

// Update category (admin only)
router.put('/:id',
  auth,
  [
    check('name').optional().trim().notEmpty(),
    check('slug').optional().trim().notEmpty(),
    check('description').optional().trim(),
    check('parentId').optional().isMongoId(),
    check('order').optional().isInt({ min: 0 }),
    check('isActive').optional().isBoolean()
  ],
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    try {
      // TODO: Add admin check
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid input data',
            details: errors.array()
          }
        });
      }

      const db = await connectToDatabase();
      const categoryId = new ObjectId(req.params.id);

      // Check if slug is unique if being updated
      if (req.body.slug) {
        const existingCategory = await db.collection('recipe_categories').findOne({
          _id: { $ne: categoryId },
          slug: req.body.slug
        });

        if (existingCategory) {
          return res.status(400).json({
            success: false,
            error: {
              code: 'DUPLICATE_SLUG',
              message: 'Category slug must be unique'
            }
          });
        }
      }

      const updateData: Partial<RecipeCategory> = {
        ...req.body,
        updatedAt: new Date()
      };

      if (req.body.parentId) {
        updateData.parentId = new ObjectId(req.body.parentId);
      }

      const result = await db.collection('recipe_categories').updateOne(
        { _id: categoryId },
        { $set: updateData }
      );

      if (result.matchedCount === 0) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'CATEGORY_NOT_FOUND',
            message: 'Category not found'
          }
        });
      }

      return res.json({ success: true });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: {
          code: 'CATEGORY_UPDATE_ERROR',
          message: error instanceof Error ? error.message : 'Error updating category'
        }
      });
    }
  })
);

// Delete category (admin only)
router.delete('/:id',
  auth,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    try {
      // TODO: Add admin check
      const db = await connectToDatabase();
      const categoryId = new ObjectId(req.params.id);

      // Check if category has recipes
      const recipesCount = await db.collection('recipes').countDocuments({
        categories: categoryId.toString()
      });

      if (recipesCount > 0) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'CATEGORY_IN_USE',
            message: 'Cannot delete category with recipes. Deactivate it instead.'
          }
        });
      }

      const result = await db.collection('recipe_categories').deleteOne({
        _id: categoryId
      });

      if (result.deletedCount === 0) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'CATEGORY_NOT_FOUND',
            message: 'Category not found'
          }
        });
      }

      return res.json({ success: true });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: {
          code: 'CATEGORY_DELETE_ERROR',
          message: error instanceof Error ? error.message : 'Error deleting category'
        }
      });
    }
  })
);

// Get user's collections
router.get('/collections',
  auth,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    try {
      const db = await connectToDatabase();
      const userId = new ObjectId(req.user!.id);

      const collections = await db.collection<RecipeCollection>('recipe_collections')
        .find({ userId })
        .sort({ createdAt: -1 })
        .toArray();

      return res.json({
        success: true,
        data: collections
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: {
          code: 'COLLECTIONS_FETCH_ERROR',
          message: error instanceof Error ? error.message : 'Error fetching collections'
        }
      });
    }
  })
);

// Create collection
router.post('/collections',
  auth,
  [
    check('name').trim().notEmpty(),
    check('description').optional().trim(),
    check('isPrivate').optional().isBoolean()
  ],
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid input data',
            details: errors.array()
          }
        });
      }

      const db = await connectToDatabase();
      const userId = new ObjectId(req.user!.id);

      const collection: Omit<RecipeCollection, '_id'> = {
        userId,
        name: req.body.name,
        description: req.body.description,
        isPrivate: req.body.isPrivate ?? false,
        recipeIds: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const result = await db.collection<RecipeCollection>('recipe_collections').insertOne(collection);

      return res.status(201).json({
        success: true,
        data: {
          collectionId: result.insertedId
        }
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: {
          code: 'COLLECTION_CREATE_ERROR',
          message: error instanceof Error ? error.message : 'Error creating collection'
        }
      });
    }
  })
);

// Update collection
router.put('/collections/:id',
  auth,
  [
    check('name').optional().trim().notEmpty(),
    check('description').optional().trim(),
    check('isPrivate').optional().isBoolean()
  ],
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid input data',
            details: errors.array()
          }
        });
      }

      const db = await connectToDatabase();
      const userId = new ObjectId(req.user!.id);
      const collectionId = new ObjectId(req.params.id);

      const updateData: Partial<RecipeCollection> = {
        ...req.body,
        updatedAt: new Date()
      };

      const result = await db.collection('recipe_collections').updateOne(
        { _id: collectionId, userId },
        { $set: updateData }
      );

      if (result.matchedCount === 0) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'COLLECTION_NOT_FOUND',
            message: 'Collection not found or unauthorized'
          }
        });
      }

      return res.json({ success: true });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: {
          code: 'COLLECTION_UPDATE_ERROR',
          message: error instanceof Error ? error.message : 'Error updating collection'
        }
      });
    }
  })
);

// Add recipe to collection
router.post('/collections/:id/recipes/:recipeId',
  auth,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    try {
      const db = await connectToDatabase();
      const userId = new ObjectId(req.user!.id);
      const collectionId = new ObjectId(req.params.id);
      const recipeId = new ObjectId(req.params.recipeId);

      // Check if collection exists and belongs to user
      const collection = await db.collection('recipe_collections').findOne({
        _id: collectionId,
        userId
      });

      if (!collection) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'COLLECTION_NOT_FOUND',
            message: 'Collection not found or unauthorized'
          }
        });
      }

      // Check if recipe exists
      const recipe = await db.collection('recipes').findOne({
        _id: recipeId
      });

      if (!recipe) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'RECIPE_NOT_FOUND',
            message: 'Recipe not found'
          }
        });
      }

      // Add recipe to collection if not already present
      const result = await db.collection('recipe_collections').updateOne(
        {
          _id: collectionId,
          userId,
          recipeIds: { $ne: recipeId }
        },
        { 
          $addToSet: { recipeIds: recipeId } as any,
          $set: { updatedAt: new Date() }
        }
      );

      if (result.matchedCount === 0) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'RECIPE_ALREADY_EXISTS',
            message: 'Recipe already in collection or collection not found'
          }
        });
      }

      return res.json({ success: true });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: {
          code: 'ADD_RECIPE_ERROR',
          message: error instanceof Error ? error.message : 'Error adding recipe to collection'
        }
      });
    }
  })
);

// Remove recipe from collection
router.delete('/collections/:id/recipes/:recipeId',
  auth,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    try {
      const db = await connectToDatabase();
      const userId = new ObjectId(req.user!.id);
      const collectionId = new ObjectId(req.params.id);
      const recipeId = new ObjectId(req.params.recipeId);

      const result = await db.collection('recipe_collections').updateOne(
        { _id: collectionId, userId },
        { 
          $pull: { recipeIds: recipeId } as any,
          $set: { updatedAt: new Date() }
        }
      );

      if (result.matchedCount === 0) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'COLLECTION_NOT_FOUND',
            message: 'Collection not found or unauthorized'
          }
        });
      }

      return res.json({ success: true });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: {
          code: 'REMOVE_RECIPE_ERROR',
          message: error instanceof Error ? error.message : 'Error removing recipe from collection'
        }
      });
    }
  })
);

// Delete collection
router.delete('/collections/:id',
  auth,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    try {
      const db = await connectToDatabase();
      const userId = new ObjectId(req.user!.id);
      const collectionId = new ObjectId(req.params.id);

      const result = await db.collection('recipe_collections').deleteOne({
        _id: collectionId,
        userId
      });

      if (result.deletedCount === 0) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'COLLECTION_NOT_FOUND',
            message: 'Collection not found or unauthorized'
          }
        });
      }

      return res.json({ success: true });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: {
          code: 'DELETE_ERROR',
          message: error instanceof Error ? error.message : 'Error deleting collection'
        }
      });
    }
  })
);

export default router; 
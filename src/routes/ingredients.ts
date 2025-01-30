import express, { Request, Response } from 'express';
import { ObjectId } from 'mongodb';
import { z } from 'zod';

import { auth } from '../middleware/auth.js';
import { rateLimiter } from '../middleware/rate-limit.js';
import { connectToDatabase } from '../db/db.js';
import { AuthenticatedRequest } from '../types/auth.js';
import { elasticClient } from '../services/elastic-client.js';
import { validateRequest } from '../middleware/validate-request.js';
import IngredientService from '../services/ingredient-service.js';
import { 
  Ingredient, 
  IngredientWithPrices,
  IngredientSource 
} from '../types/ingredient.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = express.Router();
const ingredientService = new IngredientService();

// Helper function to handle errors
const handleError = (error: unknown) => {
  if (error instanceof Error) {
    return error.message;
  }
  return 'An unexpected error occurred';
};

// Get all ingredients with optional sorting
router.get('/', rateLimiter.api(), async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const sortBy = req.query.sortBy as string || 'name';
    const order = (req.query.order as 'asc' | 'desc') || 'asc';

    // Validate sort parameters
    const allowedSortFields = ['name', 'source', 'sourceCountry', 'isPublic'];
    if (!allowedSortFields.includes(sortBy)) {
      return res.status(400).json({ message: 'Invalid sort field' });
    }

    const result = await elasticClient.search({
      index: 'ingredients',
      body: {
        size: 50,
        sort: [
          {
            [sortBy]: {
              order: order
            }
          }
        ],
        query: {
          match_all: {}
        }
      }
    });

    const ingredients = result.hits.hits.map(hit => ({
      id: hit._id,
      ...hit._source as Ingredient,
      score: hit._score
    }));

    return res.json({
      ingredients,
      total: result.hits.total,
      sortBy,
      order
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: handleError(error)
    });
  }
});

// Search ingredients
router.get('/search', rateLimiter.api(), async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const query = req.query.q as string;
    if (!query) {
      return res.status(400).json({ message: 'Search query is required' });
    }

    const result = await elasticClient.search({
      index: 'ingredients',
      body: {
        query: {
          multi_match: {
            query,
            fields: ['name^2', 'source', 'sourceCountry'],
            fuzziness: 'AUTO'
          }
        }
      }
    });

    const hits = result.hits.hits.map(hit => ({
      ...hit._source as Ingredient,
      _id: new ObjectId(hit._id),
      score: hit._score
    }));

    return res.json({
      data: hits
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: handleError(error)
    });
  }
});

// Get ingredient by ID
router.get('/:id', rateLimiter.api(), async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const db = await connectToDatabase();
    const ingredient = await db.collection<Ingredient>('ingredients').findOne({
      _id: new ObjectId(req.params.id)
    });

    if (!ingredient) {
      return res.status(404).json({ message: 'Ingredient not found' });
    }

    return res.json(ingredient);
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: handleError(error)
    });
  }
});

// Get ingredient with prices
router.get('/:id/prices', rateLimiter.api(), async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const db = await connectToDatabase();
    const ingredient = await db.collection<IngredientWithPrices>('ingredients').findOne(
      { _id: new ObjectId(req.params.id) },
      { projection: { prices: 1, name: 1 } }
    );

    if (!ingredient) {
      return res.status(404).json({ message: 'Ingredient not found' });
    }

    const days = parseInt(req.query.days as string) || 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const prices = ingredient.prices
      .filter(p => p.store.name !== undefined)
      .sort((a, b) => a.price - b.price);

    return res.json({
      name: ingredient.name,
      prices,
      days
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: handleError(error)
    });
  }
});

// Get search suggestions (auto-complete)
router.get('/suggestions', rateLimiter.api(), async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const query = req.query.q as string;
    if (!query || query.length < 2) {
      return res.status(400).json({ message: 'Query must be at least 2 characters long' });
    }

    const result = await elasticClient.search({
      index: 'ingredients',
      body: {
        size: 10,
        query: {
          bool: {
            should: [
              {
                prefix: {
                  "name.keyword": {
                    value: query,
                    boost: 2
                  }
                }
              },
              {
                match_phrase_prefix: {
                  name: {
                    query: query,
                    max_expansions: 10
                  }
                }
              }
            ]
          }
        },
        _source: ['name', 'source']
      }
    });

    const suggestions = result.hits.hits.map(hit => ({
      name: (hit._source as Pick<Ingredient, 'name' | 'source'>).name,
      source: (hit._source as Pick<Ingredient, 'name' | 'source'>).source,
      score: hit._score
    }));

    return res.json({
      suggestions
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: handleError(error)
    });
  }
});

// Admin routes below

// Validation schemas
const updateIngredientSchema = z.object({
  body: z.object({
    name: z.string().optional(),
    source: z.enum(['user', 'matspar', 'system']).optional(),
    sourceCountry: z.string().optional(),
    isPublic: z.boolean().optional(),
    image: z.string().optional(),
    nutritionalInfo: z.object({
      calories: z.number().min(0),
      protein: z.number().min(0),
      fat: z.number().min(0),
      carbs: z.number().min(0),
      fiber: z.number().min(0).optional(),
      sodium: z.number().min(0).optional(),
      unit: z.enum(['per100g', 'per100ml'])
    }).optional()
  })
});

const createIngredientSchema = z.object({
  body: z.object({
    name: z.string(),
    source: z.enum(['user', 'matspar', 'system']),
    sourceCountry: z.string(),
    isPublic: z.boolean(),
    image: z.string().optional(),
    nutritionalInfo: z.object({
      calories: z.number().min(0),
      protein: z.number().min(0),
      fat: z.number().min(0),
      carbs: z.number().min(0),
      fiber: z.number().min(0).optional(),
      sodium: z.number().min(0).optional(),
      unit: z.enum(['per100g', 'per100ml'])
    }).optional()
  })
});

const searchQuerySchema = z.object({
  query: z.object({
    q: z.string(),
    source: z.array(z.enum(['matspar', 'user', 'germanScrape', 'usScrape'])).optional(),
    country: z.array(z.string()).optional(),
    includePrivate: z.boolean().optional(),
    limit: z.number().optional(),
    offset: z.number().optional()
  })
});

// Update ingredient
router.put('/:id',
  auth,
  validateRequest(updateIngredientSchema),
  asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<Response | void> => {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const db = await connectToDatabase();
    const ingredientId = new ObjectId(req.params.id);

    const updateData: Partial<Ingredient> = {
      ...(req.body.name && { name: req.body.name }),
      ...(req.body.source && { source: req.body.source }),
      ...(req.body.sourceCountry && { sourceCountry: req.body.sourceCountry }),
      ...(typeof req.body.isPublic === 'boolean' && { isPublic: req.body.isPublic }),
      ...(req.body.image && { image: req.body.image }),
      updatedAt: new Date()
    };

    const result = await db.collection<Ingredient>('ingredients').updateOne(
      { _id: ingredientId },
      { $set: updateData }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ message: 'Ingredient not found' });
    }

    // Update in Elasticsearch
    await elasticClient.update({
      index: 'ingredients',
      id: ingredientId.toHexString(),
      body: {
        doc: {
          ...updateData,
          nutritionalInfo: req.body.nutritionalInfo
        }
      }
    });

    return res.json({
      success: true,
      message: 'Ingredient updated successfully'
    });
  })
);

// Create new ingredient
router.post('/',
  auth,
  rateLimiter.api(),
  validateRequest(createIngredientSchema),
  asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<Response | void> => {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const db = await connectToDatabase();
    const { nutritionalInfo, ...ingredientData } = req.body;
    const newIngredient: Omit<Ingredient, '_id' | 'createdAt' | 'updatedAt'> = {
      name: ingredientData.name,
      source: ingredientData.source,
      sourceCountry: ingredientData.sourceCountry,
      isPublic: ingredientData.isPublic,
      image: ingredientData.image
    };

    const result = await db.collection<Ingredient>('ingredients').insertOne({
      ...newIngredient,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    // Index in Elasticsearch with additional data
    const elasticDoc = {
      ...newIngredient,
      _id: result.insertedId.toHexString(),
      nutritionalInfo
    };

    await elasticClient.index({
      index: 'ingredients',
      id: result.insertedId.toHexString(),
      body: elasticDoc
    });

    return res.status(201).json({
      success: true,
      ingredient: {
        ...elasticDoc,
        _id: result.insertedId
      }
    });
  })
);

// Search ingredients
router.get(
  '/search',
  validateRequest(searchQuerySchema),
  asyncHandler(async (req: Request, res: Response): Promise<Response | void> => {
    const authReq = req as AuthenticatedRequest;
    const ingredients = await ingredientService.searchIngredients({
      query: req.query.q as string,
      source: req.query.source as IngredientSource[],
      country: req.query.country as string[],
      userId: authReq.user?._id?.toString(),
      includePrivate: req.query.includePrivate === 'true',
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
      offset: req.query.offset ? parseInt(req.query.offset as string) : undefined
    });
    return res.json(ingredients);
  })
);

// Get ingredient prices
router.get(
  '/:ingredientId/prices',
  asyncHandler(async (req: Request, res: Response): Promise<Response | void> => {
    const ingredient = await ingredientService.getIngredientWithPrices(
      req.params.ingredientId,
      req.query.currency as string | undefined
    );
    return res.json(ingredient);
  })
);

// Get ingredient with prices
router.get('/:id/with-prices', rateLimiter.api(), async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const db = await connectToDatabase();
    const ingredient = await db.collection<IngredientWithPrices>('ingredients').findOne(
      { _id: new ObjectId(req.params.id) },
      { projection: { prices: 1, name: 1 } }
    );

    if (!ingredient) {
      return res.status(404).json({ message: 'Ingredient not found' });
    }

    const days = parseInt(req.query.days as string) || 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const prices = ingredient.prices
      .filter(p => p.store.name !== undefined)
      .sort((a, b) => a.price - b.price);

    return res.json({
      name: ingredient.name,
      prices,
      days
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: handleError(error)
    });
  }
});

// Get auto-complete suggestions
router.get(
  '/suggestions',
  asyncHandler(async (req: Request, res: Response): Promise<Response | void> => {
    const authReq = req as AuthenticatedRequest;
    const suggestions = await ingredientService.getAutoCompleteSuggestions(
      req.query.q as string,
      authReq.user?._id?.toString(),
      req.query.limit ? parseInt(req.query.limit as string) : undefined
    );
    return res.json(suggestions);
  })
);

export default router; 
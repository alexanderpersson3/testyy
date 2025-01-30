import express, { Request, Response } from 'express';
import { check, validationResult } from 'express-validator';
import { ObjectId } from 'mongodb';

import { auth } from '../middleware/auth.js';
import { connectToDatabase } from '../db/db.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AuthenticatedRequest } from '../types/auth.js';
import { DiscoverService } from '../services/discover.js';

const router = express.Router();

// Get popular recipes
router.get('/popular',
  [
    check('category').optional().trim(),
    check('cuisine').optional().trim(),
    check('difficulty').optional().isIn(['easy', 'medium', 'hard']),
    check('maxPrepTime').optional().isInt({ min: 1 }),
    check('isPro').optional().isBoolean(),
    check('page').optional().isInt({ min: 1 }),
    check('limit').optional().isInt({ min: 1, max: 50 })
  ],
  asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const db = await connectToDatabase();
    const discoverService = new DiscoverService(db.collection('recipes'));

    const userId = (req as AuthenticatedRequest).user?.id;
    const { recipes, total } = await discoverService.getPopularRecipes({
      ...req.query,
      userId: userId ? new ObjectId(userId) : undefined
    });

    res.json({
      recipes,
      total,
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 20
    });
  })
);

// Get recent recipes
router.get('/recent',
  [
    check('category').optional().trim(),
    check('cuisine').optional().trim(),
    check('difficulty').optional().isIn(['easy', 'medium', 'hard']),
    check('maxPrepTime').optional().isInt({ min: 1 }),
    check('isPro').optional().isBoolean(),
    check('page').optional().isInt({ min: 1 }),
    check('limit').optional().isInt({ min: 1, max: 50 })
  ],
  asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const db = await connectToDatabase();
    const discoverService = new DiscoverService(db.collection('recipes'));

    const userId = (req as AuthenticatedRequest).user?.id;
    const { recipes, total } = await discoverService.getRecentRecipes({
      ...req.query,
      userId: userId ? new ObjectId(userId) : undefined
    });

    res.json({
      recipes,
      total,
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 20
    });
  })
);

// Get trending recipes
router.get('/trending',
  [
    check('category').optional().trim(),
    check('cuisine').optional().trim(),
    check('difficulty').optional().isIn(['easy', 'medium', 'hard']),
    check('maxPrepTime').optional().isInt({ min: 1 }),
    check('isPro').optional().isBoolean(),
    check('page').optional().isInt({ min: 1 }),
    check('limit').optional().isInt({ min: 1, max: 50 })
  ],
  asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const db = await connectToDatabase();
    const discoverService = new DiscoverService(db.collection('recipes'));

    const userId = (req as AuthenticatedRequest).user?.id;
    const { recipes, total } = await discoverService.getTrendingRecipes({
      ...req.query,
      userId: userId ? new ObjectId(userId) : undefined
    });

    res.json({
      recipes,
      total,
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 20
    });
  })
);

// Get recommended recipes (requires authentication)
router.get('/recommended',
  auth,
  [
    check('category').optional().trim(),
    check('cuisine').optional().trim(),
    check('difficulty').optional().isIn(['easy', 'medium', 'hard']),
    check('maxPrepTime').optional().isInt({ min: 1 }),
    check('isPro').optional().isBoolean(),
    check('page').optional().isInt({ min: 1 }),
    check('limit').optional().isInt({ min: 1, max: 50 })
  ],
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const db = await connectToDatabase();
    const discoverService = new DiscoverService(db.collection('recipes'));

    const { recipes, total } = await discoverService.getRecommendedRecipes(
      new ObjectId(req.user!.id),
      req.query
    );

    res.json({
      recipes,
      total,
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 20
    });
  })
);

// Get popular categories
router.get('/categories/popular',
  asyncHandler(async (req: Request, res: Response) => {
    const db = await connectToDatabase();
    const discoverService = new DiscoverService(db.collection('recipes'));

    const categories = await discoverService.getPopularCategories();
    res.json({ categories });
  })
);

// Get popular cuisines
router.get('/cuisines/popular',
  asyncHandler(async (req: Request, res: Response) => {
    const db = await connectToDatabase();
    const discoverService = new DiscoverService(db.collection('recipes'));

    const cuisines = await discoverService.getPopularCuisines();
    res.json({ cuisines });
  })
);

export default router; 
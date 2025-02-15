import { Router } from 'express';
import { z } from 'zod';
import { ObjectId } from 'mongodb';
import { getDb } from '../db.js';
import { elasticClient } from '../services/elastic-client.js';
const { authenticateToken } = require('../middleware/auth');

const router = Router();

// Validation schemas
const searchRecipesSchema = z
  .object({
    query: z.string().optional(),
    filters: z
      .object({
        dietary: z.array(z.string()).optional(),
        cuisine: z.array(z.string()).optional(),
        difficulty: z.array(z.string()).optional(),
        cookingTime: z
          .object({
            min: z.number().optional(),
            max: z.number().optional(),
          })
          .optional(),
        ingredients: z.array(z.string()).optional(),
      })
      .optional(),
    sort: z.enum(['relevance', 'date', 'rating', 'cooking_time', 'difficulty']).optional(),
    page: z.number().int().positive().optional(),
    limit: z.number().int().min(1).max(50).optional(),
  })
  .strict();

const searchUsersSchema = z
  .object({
    query: z.string().optional(),
    filters: z
      .object({
        role: z.string().optional(),
        subscription_tier: z.string().optional(),
      })
      .optional(),
    page: z.number().int().positive().optional(),
    limit: z.number().int().min(1).max(50).optional(),
  })
  .strict();

const searchCollectionsSchema = z
  .object({
    query: z.string().optional(),
    userId: z.string().optional(),
    page: z.number().int().positive().optional(),
    limit: z.number().int().min(1).max(50).optional(),
  })
  .strict();

// Routes
router.get(
  '/recipes',
  authenticateToken,
  validateRequest(searchRecipesSchema, 'query'),
  async (req, res) => {
    try {
      const { query, filters, sort, page = 1, limit = 10 } = req.query;
      const results = await searchService.searchRecipes(
        query,
        filters ? JSON.parse(filters) : {},
        sort,
        parseInt(page),
        parseInt(limit)
      );
      res.json(results);
    } catch (err) {
      console.error('Recipe search error:', err);
      res.status(500).json({ error: 'Failed to search recipes' });
    }
  }
);

router.get(
  '/users',
  authenticateToken,
  validateRequest(searchUsersSchema, 'query'),
  async (req, res) => {
    try {
      const { query, filters, page = 1, limit = 10 } = req.query;
      const results = await searchService.searchUsers(
        query,
        filters ? JSON.parse(filters) : {},
        parseInt(page),
        parseInt(limit)
      );
      res.json(results);
    } catch (err) {
      console.error('User search error:', err);
      res.status(500).json({ error: 'Failed to search users' });
    }
  }
);

router.get('/collections', validateRequest(searchCollectionsSchema, 'query'), async (req, res) => {
  try {
    const { query, userId, page = 1, limit = 10 } = req.query;
    const results = await searchService.searchCollections(
      query,
      userId,
      parseInt(page),
      parseInt(limit)
    );
    res.json(results);
  } catch (err) {
    console.error('Collection search error:', err);
    res.status(500).json({ error: 'Failed to search collections' });
  }
});

router.get('/suggestions', async (req, res) => {
  try {
    const { query, type = 'recipe' } = req.query;
    if (!query) {
      return res.json([]);
    }
    const suggestions = await searchService.getSearchSuggestions(query, type);
    res.json(suggestions);
  } catch (err) {
    console.error('Search suggestions error:', err);
    res.status(500).json({ error: 'Failed to get search suggestions' });
  }
});

// Search recipes
router.get('/recipes', async (req, res) => {
  try {
    const {
      q,
      page = 1,
      limit = 10,
      cuisine,
      difficulty,
      maxTime,
      minRating,
      ingredients,
      excludeIngredients,
      dietary,
      sort = 'relevance',
    } = req.query;

    const must = [{ match: { isPrivate: false } }];
    const should = [];
    const filter = [];

    if (q) {
      should.push(
        { match: { title: { query: q, boost: 3 } } },
        { match: { description: { query: q, boost: 2 } } },
        { match: { instructions: { query: q } } },
        { match: { tags: { query: q, boost: 2 } } }
      );
    }

    if (cuisine) filter.push({ term: { cuisine } });
    if (difficulty) filter.push({ term: { difficulty } });
    if (maxTime) filter.push({ range: { cookingTime: { lte: parseInt(maxTime) } } });
    if (minRating) filter.push({ range: { averageRating: { gte: parseFloat(minRating) } } });

    if (ingredients) {
      const ingredientList = ingredients.split(',');
      filter.push({
        terms: { 'ingredients.name': ingredientList },
      });
    }

    if (excludeIngredients) {
      const excludeList = excludeIngredients.split(',');
      must.push({
        bool: {
          must_not: {
            terms: { 'ingredients.name': excludeList },
          },
        },
      });
    }

    if (dietary) {
      const dietaryRestrictions = dietary.split(',');
      must.push({
        bool: {
          must_not: {
            terms: { 'ingredients.allergens': dietaryRestrictions },
          },
        },
      });
    }

    let sortQuery = [{ _score: 'desc' }];
    if (sort === 'date') sortQuery = [{ createdAt: 'desc' }];
    if (sort === 'rating') sortQuery = [{ averageRating: 'desc' }];
    if (sort === 'popularity') sortQuery = [{ popularity: 'desc' }];

    const { body } = await elasticClient.search({
      index: 'recipes',
      body: {
        from: (parseInt(page) - 1) * parseInt(limit),
        size: parseInt(limit),
        query: {
          bool: {
            must,
            should,
            filter,
            minimum_should_match: q ? 1 : 0,
          },
        },
        sort: sortQuery,
        highlight: {
          fields: {
            title: {},
            description: {},
            instructions: {},
          },
        },
        aggs: {
          cuisines: {
            terms: { field: 'cuisine.keyword' },
          },
          difficulties: {
            terms: { field: 'difficulty.keyword' },
          },
          avgTime: {
            avg: { field: 'cookingTime' },
          },
          avgRating: {
            avg: { field: 'averageRating' },
          },
        },
      },
    });

    // Log search query
    const db = getDb();
    await db.collection('search_logs').insertOne({
      type: 'RECIPE',
      query: q,
      filters: {
        cuisine,
        difficulty,
        maxTime,
        minRating,
        ingredients,
        excludeIngredients,
        dietary,
        sort,
      },
      resultCount: body.hits.total.value,
      timestamp: new Date(),
      userId: req.user ? new ObjectId(req.user.id) : null,
    });

    res.json({
      hits: body.hits.hits.map(hit => ({
        ...hit._source,
        score: hit._score,
        highlights: hit.highlight,
      })),
      total: body.hits.total.value,
      page: parseInt(page),
      pages: Math.ceil(body.hits.total.value / parseInt(limit)),
      aggregations: body.aggregations,
    });
  } catch (error) {
    throw error;
  }
});

// Search users
router.get('/users', async (req, res) => {
  try {
    const { q, page = 1, limit = 10, sort = 'relevance' } = req.query;

    const must = [];
    if (q) {
      must.push({
        multi_match: {
          query: q,
          fields: ['username^3', 'displayName^2', 'bio'],
          fuzziness: 'AUTO',
        },
      });
    }

    let sortQuery = [{ _score: 'desc' }];
    if (sort === 'recipes') sortQuery = [{ recipeCount: 'desc' }];
    if (sort === 'followers') sortQuery = [{ followerCount: 'desc' }];

    const { body } = await elasticClient.search({
      index: 'users',
      body: {
        from: (parseInt(page) - 1) * parseInt(limit),
        size: parseInt(limit),
        query: {
          bool: {
            must,
          },
        },
        sort: sortQuery,
        highlight: {
          fields: {
            username: {},
            displayName: {},
            bio: {},
          },
        },
      },
    });

    // Log search query
    const db = getDb();
    await db.collection('search_logs').insertOne({
      type: 'USER',
      query: q,
      filters: { sort },
      resultCount: body.hits.total.value,
      timestamp: new Date(),
      userId: req.user ? new ObjectId(req.user.id) : null,
    });

    res.json({
      hits: body.hits.hits.map(hit => ({
        ...hit._source,
        score: hit._score,
        highlights: hit.highlight,
      })),
      total: body.hits.total.value,
      page: parseInt(page),
      pages: Math.ceil(body.hits.total.value / parseInt(limit)),
    });
  } catch (error) {
    throw error;
  }
});

// Search ingredients
router.get('/ingredients', async (req, res) => {
  try {
    const { q, page = 1, limit = 10, category, season, sort = 'relevance' } = req.query;

    const must = [];
    const filter = [];

    if (q) {
      must.push({
        multi_match: {
          query: q,
          fields: ['name^3', 'description^2', 'tags'],
          fuzziness: 'AUTO',
        },
      });
    }

    if (category) filter.push({ term: { category } });
    if (season) filter.push({ term: { seasonality: parseInt(season) } });

    let sortQuery = [{ _score: 'desc' }];
    if (sort === 'popularity') sortQuery = [{ popularity: 'desc' }];
    if (sort === 'price') sortQuery = [{ 'currentPrice.amount': 'asc' }];

    const { body } = await elasticClient.search({
      index: 'ingredients',
      body: {
        from: (parseInt(page) - 1) * parseInt(limit),
        size: parseInt(limit),
        query: {
          bool: {
            must,
            filter,
          },
        },
        sort: sortQuery,
        highlight: {
          fields: {
            name: {},
            description: {},
            tags: {},
          },
        },
        aggs: {
          categories: {
            terms: { field: 'category.keyword' },
          },
          seasons: {
            terms: { field: 'seasonality' },
          },
        },
      },
    });

    // Log search query
    const db = getDb();
    await db.collection('search_logs').insertOne({
      type: 'INGREDIENT',
      query: q,
      filters: {
        category,
        season,
        sort,
      },
      resultCount: body.hits.total.value,
      timestamp: new Date(),
      userId: req.user ? new ObjectId(req.user.id) : null,
    });

    res.json({
      hits: body.hits.hits.map(hit => ({
        ...hit._source,
        score: hit._score,
        highlights: hit.highlight,
      })),
      total: body.hits.total.value,
      page: parseInt(page),
      pages: Math.ceil(body.hits.total.value / parseInt(limit)),
      aggregations: body.aggregations,
    });
  } catch (error) {
    throw error;
  }
});

// Get search suggestions
router.get('/suggestions', async (req, res) => {
  try {
    const { q, type = 'recipe' } = req.query;

    if (!q) {
      return res.json({ suggestions: [] });
    }

    const index = type === 'user' ? 'users' : type === 'ingredient' ? 'ingredients' : 'recipes';
    const fields = {
      recipes: ['title^3', 'tags^2', 'ingredients.name'],
      users: ['username^3', 'displayName^2'],
      ingredients: ['name^3', 'tags^2'],
    }[type];

    const { body } = await elasticClient.search({
      index,
      body: {
        size: 5,
        query: {
          multi_match: {
            query: q,
            fields,
            type: 'phrase_prefix',
          },
        },
        highlight: {
          fields: {
            title: {},
            username: {},
            displayName: {},
            name: {},
            tags: {},
          },
        },
      },
    });

    res.json({
      suggestions: body.hits.hits.map(hit => ({
        id: hit._id,
        text: hit._source.title || hit._source.username || hit._source.name,
        highlights: hit.highlight,
      })),
    });
  } catch (error) {
    throw error;
  }
});

// Get trending searches
router.get('/trending', async (req, res) => {
  try {
    const db = getDb();
    const { type = 'recipe', period = '7d' } = req.query;

    const periodMap = {
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
      '30d': 30 * 24 * 60 * 60 * 1000,
    };

    const trending = await db
      .collection('search_logs')
      .aggregate([
        {
          $match: {
            type: type.toUpperCase(),
            timestamp: {
              $gte: new Date(Date.now() - periodMap[period]),
            },
            query: { $ne: null },
          },
        },
        {
          $group: {
            _id: '$query',
            count: { $sum: 1 },
            avgResults: { $avg: '$resultCount' },
            lastSearched: { $max: '$timestamp' },
          },
        },
        {
          $sort: { count: -1 },
        },
        {
          $limit: 10,
        },
      ])
      .toArray();

    res.json({ trending });
  } catch (error) {
    throw error;
  }
});

// Get search history (authenticated users only)
router.get('/history', authenticateToken, async (req, res) => {
  try {
    const db = getDb();
    const userId = new ObjectId(req.user.id);
    const { page = 1, limit = 20 } = req.query;

    const history = await db
      .collection('search_logs')
      .find({ userId })
      .sort({ timestamp: -1 })
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit))
      .toArray();

    const total = await db.collection('search_logs').countDocuments({ userId });

    res.json({
      history,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
    });
  } catch (error) {
    throw error;
  }
});

// Clear search history
router.delete('/history', authenticateToken, async (req, res) => {
  try {
    const db = getDb();
    const userId = new ObjectId(req.user.id);

    await db.collection('search_logs').deleteMany({ userId });

    res.json({ message: 'Search history cleared successfully' });
  } catch (error) {
    throw error;
  }
});

export default router;

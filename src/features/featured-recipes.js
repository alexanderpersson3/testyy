const express = require('express');
const router = express.Router();
const { ObjectId } = require('mongodb');
const auth = require('../middleware/auth');
const { getDb } = require('../db');

// Feature types and limits
const FEATURE_TYPES = ['trending', 'seasonal', 'editors_choice', 'popular'];
const MAX_FEATURED_PER_TYPE = 10;

// Helper function to check if user is moderator
async function isModerator(userId) {
  const db = getDb();
  const user = await db.collection('users').findOne({
    _id: new ObjectId(userId),
  });
  return user && user.role === 'moderator';
}

// Feature a recipe
router.post('/', auth, async (req, res) => {
  try {
    const db = getDb();
    const { recipeId, type, startDate, endDate, priority = 1 } = req.body;

    // Check moderator permission
    if (!(await isModerator(req.user.id))) {
      return res.status(403).json({
        success: false,
        message: 'Only moderators can feature recipes',
      });
    }

    // Validate feature type
    if (!FEATURE_TYPES.includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid feature type',
      });
    }

    // Check if recipe exists
    const recipe = await db.collection('recipes').findOne({
      _id: new ObjectId(recipeId),
      status: 'published',
    });

    if (!recipe) {
      return res.status(404).json({
        success: false,
        message: 'Recipe not found or not published',
      });
    }

    // Check feature limit
    const activeFeatures = await db.collection('featuredRecipes').countDocuments({
      type,
      startDate: { $lte: new Date() },
      endDate: { $gte: new Date() },
    });

    if (activeFeatures >= MAX_FEATURED_PER_TYPE) {
      return res.status(400).json({
        success: false,
        message: `Maximum number of featured recipes (${MAX_FEATURED_PER_TYPE}) for this type reached`,
      });
    }

    const feature = {
      recipeId: new ObjectId(recipeId),
      type,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      priority,
      moderatorId: new ObjectId(req.user.id),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await db.collection('featuredRecipes').insertOne(feature);
    feature._id = result.insertedId;

    res.status(201).json({
      success: true,
      data: feature,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Error featuring recipe',
    });
  }
});

// Get featured recipes
router.get('/', async (req, res) => {
  try {
    const db = getDb();
    const { type } = req.query;
    const now = new Date();

    const query = {
      startDate: { $lte: now },
      endDate: { $gte: now },
    };

    if (type && FEATURE_TYPES.includes(type)) {
      query.type = type;
    }

    const features = await db
      .collection('featuredRecipes')
      .aggregate([
        { $match: query },
        { $sort: { priority: -1 } },
        {
          $lookup: {
            from: 'recipes',
            localField: 'recipeId',
            foreignField: '_id',
            as: 'recipe',
          },
        },
        { $unwind: '$recipe' },
        {
          $lookup: {
            from: 'users',
            localField: 'recipe.userId',
            foreignField: '_id',
            as: 'author',
          },
        },
        { $unwind: '$author' },
        {
          $project: {
            _id: 1,
            type: 1,
            startDate: 1,
            endDate: 1,
            priority: 1,
            recipe: {
              _id: '$recipe._id',
              title: '$recipe.title',
              description: '$recipe.description',
              image: '$recipe.image',
              author: {
                _id: '$author._id',
                name: '$author.name',
              },
            },
          },
        },
      ])
      .toArray();

    res.json({
      success: true,
      data: features,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Error fetching featured recipes',
    });
  }
});

// Update featured recipe
router.put('/:featureId', auth, async (req, res) => {
  try {
    const db = getDb();
    const { featureId } = req.params;
    const { type, startDate, endDate, priority } = req.body;

    // Check moderator permission
    if (!(await isModerator(req.user.id))) {
      return res.status(403).json({
        success: false,
        message: 'Only moderators can update featured recipes',
      });
    }

    const feature = await db.collection('featuredRecipes').findOne({
      _id: new ObjectId(featureId),
    });

    if (!feature) {
      return res.status(404).json({
        success: false,
        message: 'Featured recipe not found',
      });
    }

    if (type && !FEATURE_TYPES.includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid feature type',
      });
    }

    const update = {
      $set: {
        type: type || feature.type,
        startDate: startDate ? new Date(startDate) : feature.startDate,
        endDate: endDate ? new Date(endDate) : feature.endDate,
        priority: priority || feature.priority,
        updatedAt: new Date(),
      },
    };

    await db.collection('featuredRecipes').updateOne({ _id: new ObjectId(featureId) }, update);

    res.json({
      success: true,
      message: 'Featured recipe updated successfully',
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Error updating featured recipe',
    });
  }
});

// Remove recipe from featured
router.delete('/:featureId', auth, async (req, res) => {
  try {
    const db = getDb();
    const { featureId } = req.params;

    // Check moderator permission
    if (!(await isModerator(req.user.id))) {
      return res.status(403).json({
        success: false,
        message: 'Only moderators can remove featured recipes',
      });
    }

    const result = await db.collection('featuredRecipes').deleteOne({
      _id: new ObjectId(featureId),
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Featured recipe not found',
      });
    }

    res.json({
      success: true,
      message: 'Recipe removed from featured successfully',
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Error removing featured recipe',
    });
  }
});

// Get featured recipes stats
router.get('/stats', auth, async (req, res) => {
  try {
    const db = getDb();

    // Check moderator permission
    if (!(await isModerator(req.user.id))) {
      return res.status(403).json({
        success: false,
        message: 'Only moderators can view featured stats',
      });
    }

    const now = new Date();
    const stats = await db
      .collection('featuredRecipes')
      .aggregate([
        {
          $facet: {
            byType: [
              {
                $match: {
                  startDate: { $lte: now },
                  endDate: { $gte: now },
                },
              },
              {
                $group: {
                  _id: '$type',
                  count: { $sum: 1 },
                },
              },
            ],
            total: [
              {
                $match: {
                  startDate: { $lte: now },
                  endDate: { $gte: now },
                },
              },
              {
                $count: 'count',
              },
            ],
            upcoming: [
              {
                $match: {
                  startDate: { $gt: now },
                },
              },
              {
                $count: 'count',
              },
            ],
            expired: [
              {
                $match: {
                  endDate: { $lt: now },
                },
              },
              {
                $count: 'count',
              },
            ],
          },
        },
      ])
      .toArray();

    res.json({
      success: true,
      data: stats[0],
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Error fetching featured stats',
    });
  }
});

module.exports = router;

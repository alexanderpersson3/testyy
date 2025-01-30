const express = require('express');
const router = express.Router();
const { getDb } = require('../db');

// Advanced search endpoint with filters
router.get('/search', async (req, res) => {
  try {
    const db = getDb();
    const {
      query,
      ingredients,
      tags,
      difficulty,
      prepTime,
      sortBy,
      page = 1,
      limit = 10
    } = req.query;

    // Build search query
    const searchQuery = {
      status: 'published',
      $or: []
    };

    // Text search
    if (query) {
      searchQuery.$or.push(
        { title: { $regex: query, $options: 'i' } },
        { description: { $regex: query, $options: 'i' } }
      );
    }

    // Ingredient filter
    if (ingredients) {
      const ingredientList = ingredients.split(',');
      searchQuery['ingredients.name'] = { $in: ingredientList };
    }

    // Tags filter
    if (tags) {
      const tagList = tags.split(',');
      searchQuery.tags = { $in: tagList };
    }

    // Difficulty filter
    if (difficulty) {
      searchQuery.difficulty = difficulty;
    }

    // Prep time filter
    if (prepTime) {
      const [min, max] = prepTime.split('-').map(Number);
      searchQuery.prepTime = { $gte: min, $lte: max };
    }

    // If no specific filters are applied, remove $or
    if (searchQuery.$or.length === 0) {
      delete searchQuery.$or;
    }

    // Build sort options
    const sortOptions = {};
    switch (sortBy) {
      case 'newest':
        sortOptions.createdAt = -1;
        break;
      case 'popular':
        sortOptions.likesCount = -1;
        break;
      case 'rating':
        sortOptions.averageRating = -1;
        break;
      default:
        sortOptions.createdAt = -1;
    }

    // Pagination
    const skip = (page - 1) * limit;

    // Execute search with aggregation pipeline
    const recipes = await db.collection('recipes')
      .aggregate([
        { $match: searchQuery },
        // Join with likes collection to get likes count
        {
          $lookup: {
            from: 'likes',
            localField: '_id',
            foreignField: 'recipeId',
            as: 'likes'
          }
        },
        {
          $addFields: {
            likesCount: { $size: '$likes' }
          }
        },
        // Join with comments for rating
        {
          $lookup: {
            from: 'comments',
            localField: '_id',
            foreignField: 'recipeId',
            as: 'comments'
          }
        },
        {
          $addFields: {
            averageRating: {
              $avg: '$comments.rating'
            }
          }
        },
        // Sort and paginate
        { $sort: sortOptions },
        { $skip: skip },
        { $limit: parseInt(limit) },
        // Clean up response
        {
          $project: {
            likes: 0,
            comments: 0
          }
        }
      ])
      .toArray();

    // Get total count for pagination
    const total = await db.collection('recipes').countDocuments(searchQuery);

    res.json({
      success: true,
      data: {
        recipes,
        pagination: {
          total,
          page: parseInt(page),
          totalPages: Math.ceil(total / limit)
        }
      }
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Error searching recipes'
    });
  }
});

// Get recipe suggestions
router.get('/suggestions', async (req, res) => {
  try {
    const db = getDb();
    const { query } = req.query;

    if (!query || query.length < 2) {
      return res.json({
        success: true,
        data: []
      });
    }

    const suggestions = await db.collection('recipes')
      .find(
        {
          status: 'published',
          title: { $regex: query, $options: 'i' }
        },
        {
          projection: {
            title: 1,
            description: 1
          }
        }
      )
      .limit(5)
      .toArray();

    res.json({
      success: true,
      data: suggestions
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Error fetching suggestions'
    });
  }
});

// Get popular tags
router.get('/tags', async (req, res) => {
  try {
    const db = getDb();
    
    const tags = await db.collection('recipes')
      .aggregate([
        { $match: { status: 'published' } },
        { $unwind: '$tags' },
        {
          $group: {
            _id: '$tags',
            count: { $sum: 1 }
          }
        },
        { $sort: { count: -1 } },
        { $limit: 20 }
      ])
      .toArray();

    res.json({
      success: true,
      data: tags
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Error fetching tags'
    });
  }
});

module.exports = router; 
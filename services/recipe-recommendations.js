import { getDb } from '../config/db.js';
import { ObjectId } from 'mongodb';

class RecipeRecommendations {
  /**
   * Get similar recipes based on tags, ingredients, and user behavior
   * @param {string} recipeId Recipe ID
   * @param {number} limit Number of recommendations to return
   * @returns {Promise<Array>} Similar recipes
   */
  async getSimilarRecipes(recipeId, limit = 5) {
    try {
      const db = getDb();

      // Get the source recipe
      const recipe = await db.collection('recipes').findOne({
        _id: new ObjectId(recipeId)
      });

      if (!recipe) {
        throw new Error('Recipe not found');
      }

      // Find similar recipes based on tags and ingredients
      const similarRecipes = await db.collection('recipes').aggregate([
        {
          $match: {
            _id: { $ne: new ObjectId(recipeId) },
            $or: [
              { tags: { $in: recipe.tags || [] } },
              { 'ingredients.name': { $in: recipe.ingredients.map(i => i.name) } },
              { category: recipe.category }
            ]
          }
        },
        // Calculate similarity score
        {
          $addFields: {
            similarityScore: {
              $add: [
                // Tag overlap score
                {
                  $multiply: [
                    {
                      $size: {
                        $setIntersection: ['$tags', recipe.tags || []]
                      }
                    },
                    2 // Weight for tag matches
                  ]
                },
                // Ingredient overlap score
                {
                  $multiply: [
                    {
                      $size: {
                        $setIntersection: [
                          '$ingredients.name',
                          recipe.ingredients.map(i => i.name)
                        ]
                      }
                    },
                    1 // Weight for ingredient matches
                  ]
                },
                // Category match score
                {
                  $cond: [
                    { $eq: ['$category', recipe.category] },
                    3, // Weight for category match
                    0
                  ]
                }
              ]
            }
          }
        },
        // Add popularity signals
        {
          $addFields: {
            popularityScore: {
              $add: [
                { $multiply: ['$viewCount', 0.1] },
                { $multiply: ['$saveCount', 0.5] },
                { $multiply: ['$averageRating', 2] }
              ]
            }
          }
        },
        // Combine similarity and popularity scores
        {
          $addFields: {
            finalScore: {
              $add: [
                { $multiply: ['$similarityScore', 0.7] }, // 70% weight for similarity
                { $multiply: ['$popularityScore', 0.3] }  // 30% weight for popularity
              ]
            }
          }
        },
        { $sort: { finalScore: -1 } },
        { $limit: limit },
        // Project only necessary fields
        {
          $project: {
            _id: 1,
            title: 1,
            description: 1,
            images: 1,
            difficulty: 1,
            prepTime: 1,
            cookTime: 1,
            averageRating: 1,
            reviewCount: 1,
            author: 1
          }
        }
      ]).toArray();

      return similarRecipes;
    } catch (error) {
      console.error('Error getting similar recipes:', error);
      throw error;
    }
  }

  /**
   * Get top picks based on ratings, popularity, and freshness
   * @param {Object} options Query options
   * @returns {Promise<Array>} Top picks
   */
  async getTopPicks({ limit = 20, offset = 0, userId = null } = {}) {
    try {
      const db = getDb();
      const pipeline = [];

      // Match only published recipes
      pipeline.push({
        $match: {
          status: 'published'
        }
      });

      // Calculate popularity score
      pipeline.push({
        $addFields: {
          popularityScore: {
            $add: [
              { $multiply: ['$viewCount', 0.2] },
              { $multiply: ['$saveCount', 0.3] },
              { $multiply: ['$averageRating', 3] },
              {
                $multiply: [
                  {
                    $divide: [
                      1,
                      {
                        $add: [
                          1,
                          {
                            $divide: [
                              { $subtract: [new Date(), '$createdAt'] },
                              1000 * 60 * 60 * 24 // Convert ms to days
                            ]
                          }
                        ]
                      }
                    ]
                  },
                  5 // Weight for freshness
                ]
              }
            ]
          }
        }
      });

      // If user is provided, factor in their preferences
      if (userId) {
        const user = await db.collection('users').findOne(
          { _id: new ObjectId(userId) },
          { projection: { preferences: 1 } }
        );

        if (user?.preferences) {
          pipeline.push({
            $addFields: {
              preferenceScore: {
                $cond: {
                  if: {
                    $or: [
                      { $in: [user.preferences.cuisine, '$tags'] },
                      { $eq: [user.preferences.difficulty, '$difficulty'] }
                    ]
                  },
                  then: 2,
                  else: 0
                }
              }
            }
          });

          pipeline.push({
            $addFields: {
              popularityScore: {
                $add: ['$popularityScore', '$preferenceScore']
              }
            }
          });
        }
      }

      // Sort and paginate
      pipeline.push(
        { $sort: { popularityScore: -1 } },
        { $skip: offset },
        { $limit: limit },
        {
          $project: {
            _id: 1,
            title: 1,
            description: 1,
            images: 1,
            difficulty: 1,
            prepTime: 1,
            cookTime: 1,
            averageRating: 1,
            reviewCount: 1,
            author: 1,
            tags: 1
          }
        }
      );

      return await db.collection('recipes').aggregate(pipeline).toArray();
    } catch (error) {
      console.error('Error getting top picks:', error);
      throw error;
    }
  }

  /**
   * Get trending recipes based on recent activity
   * @param {Object} options Query options
   * @returns {Promise<Array>} Trending recipes
   */
  async getTrendingRecipes({ limit = 20, offset = 0, timeframe = '7d' } = {}) {
    try {
      const db = getDb();

      // Calculate timeframe in milliseconds
      const timeframes = {
        '24h': 24 * 60 * 60 * 1000,
        '7d': 7 * 24 * 60 * 60 * 1000,
        '30d': 30 * 24 * 60 * 60 * 1000
      };

      const since = new Date(Date.now() - timeframes[timeframe]);

      // Get recent activity
      const recentActivity = await db.collection('recipeActivity')
        .aggregate([
          {
            $match: {
              timestamp: { $gte: since }
            }
          },
          {
            $group: {
              _id: '$recipeId',
              views: {
                $sum: { $cond: [{ $eq: ['$type', 'view'] }, 1, 0] }
              },
              saves: {
                $sum: { $cond: [{ $eq: ['$type', 'save'] }, 1, 0] }
              },
              comments: {
                $sum: { $cond: [{ $eq: ['$type', 'comment'] }, 1, 0] }
              },
              ratings: {
                $sum: { $cond: [{ $eq: ['$type', 'rate'] }, 1, 0] }
              }
            }
          },
          {
            $addFields: {
              trendingScore: {
                $add: [
                  { $multiply: ['$views', 1] },
                  { $multiply: ['$saves', 5] },
                  { $multiply: ['$comments', 3] },
                  { $multiply: ['$ratings', 4] }
                ]
              }
            }
          },
          { $sort: { trendingScore: -1 } },
          { $skip: offset },
          { $limit: limit }
        ])
        .toArray();

      // Get recipe details for trending recipes
      if (recentActivity.length > 0) {
        const recipeIds = recentActivity.map(a => new ObjectId(a._id));
        const recipes = await db.collection('recipes')
          .find(
            { _id: { $in: recipeIds } },
            {
              projection: {
                _id: 1,
                title: 1,
                description: 1,
                images: 1,
                difficulty: 1,
                prepTime: 1,
                cookTime: 1,
                averageRating: 1,
                reviewCount: 1,
                author: 1,
                tags: 1
              }
            }
          )
          .toArray();

        // Merge trending scores with recipe details
        const trendingScores = recentActivity.reduce((acc, curr) => {
          acc[curr._id.toString()] = curr.trendingScore;
          return acc;
        }, {});

        return recipes
          .map(recipe => ({
            ...recipe,
            trendingScore: trendingScores[recipe._id.toString()]
          }))
          .sort((a, b) => b.trendingScore - a.trendingScore);
      }

      return [];
    } catch (error) {
      console.error('Error getting trending recipes:', error);
      throw error;
    }
  }
}

export default new RecipeRecommendations(); 
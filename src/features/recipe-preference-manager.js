import { getDb } from '../config/db.js';
import { ObjectId } from 'mongodb';
import Redis from 'ioredis';

class RecipePreferenceManager {
  constructor() {
    this.redis = new Redis(process.env.REDIS_URL);
    this.CACHE_TTL = 60 * 60; // 1 hour in seconds
    this.USER_PREFERENCES_CACHE_PREFIX = 'user:preferences:';
    this.FILTERED_RECIPES_CACHE_PREFIX = 'user:filtered_recipes:';

    // Standard dietary preferences
    this.DIETARY_PREFERENCES = [
      'vegan',
      'vegetarian',
      'pescatarian',
      'paleo',
      'keto',
      'gluten_free',
      'dairy_free',
      'low_carb',
      'low_fat',
      'halal',
      'kosher',
    ];

    // Standard cuisines
    this.CUISINES = [
      'italian',
      'french',
      'mexican',
      'thai',
      'indian',
      'chinese',
      'japanese',
      'mediterranean',
      'swedish',
      'american',
    ];

    // Common allergens
    this.ALLERGENS = ['peanuts', 'tree_nuts', 'dairy', 'eggs', 'soy', 'wheat', 'fish', 'shellfish'];

    // Preference weights for scoring
    this.weights = {
      dietMatch: 2.0,
      cuisineMatch: 1.5,
      basePopularity: 1.0,
      userRating: 1.2,
    };
  }

  /**
   * Update user preferences
   * @param {string} userId User ID
   * @param {Object} preferences User preferences
   * @returns {Promise<Object>} Updated preferences
   */
  async updatePreferences(
    userId,
    { preferredDiets = [], excludedDiets = [], allergens = [], cuisinePreferences = [] }
  ) {
    try {
      const db = getDb();
      const now = new Date();

      // Validate preferences
      const validPreferences = {
        preferredDiets: preferredDiets.filter(diet => this.DIETARY_PREFERENCES.includes(diet)),
        excludedDiets: excludedDiets.filter(diet => this.DIETARY_PREFERENCES.includes(diet)),
        allergens: allergens.filter(allergen => this.ALLERGENS.includes(allergen)),
        cuisinePreferences: cuisinePreferences.filter(
          pref =>
            this.CUISINES.includes(pref.cuisine) &&
            ['high', 'medium', 'low'].includes(pref.likeLevel)
        ),
      };

      // Update preferences
      const result = await db.collection('userPreferences').findOneAndUpdate(
        { userId: new ObjectId(userId) },
        {
          $set: {
            ...validPreferences,
            updatedAt: now,
          },
        },
        {
          upsert: true,
          returnDocument: 'after',
        }
      );

      // Invalidate cache
      await this.invalidateUserCache(userId);

      return result;
    } catch (error) {
      console.error('Error updating user preferences:', error);
      throw error;
    }
  }

  /**
   * Get user preferences
   * @param {string} userId User ID
   * @returns {Promise<Object>} User preferences
   */
  async getPreferences(userId) {
    try {
      // Try to get cached preferences
      const cacheKey = `${this.USER_PREFERENCES_CACHE_PREFIX}${userId}`;
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      const db = getDb();
      const preferences = await db.collection('userPreferences').findOne({
        userId: new ObjectId(userId),
      });

      if (preferences) {
        // Cache preferences
        await this.redis.setex(cacheKey, this.CACHE_TTL, JSON.stringify(preferences));
      }

      return preferences;
    } catch (error) {
      console.error('Error getting user preferences:', error);
      throw error;
    }
  }

  /**
   * Calculate recipe score based on user preferences
   * @param {Object} recipe Recipe object
   * @param {Object} preferences User preferences
   * @returns {number} Recipe score
   */
  calculateRecipeScore(recipe, preferences) {
    let score = this.weights.basePopularity * (recipe.popularity || 1);

    // Add rating score
    if (recipe.averageRating) {
      score += this.weights.userRating * recipe.averageRating;
    }

    // Diet match bonus
    const dietMatches =
      recipe.dietaryTags?.filter(tag => preferences.preferredDiets?.includes(tag)).length || 0;
    score += this.weights.dietMatch * dietMatches;

    // Cuisine match bonus
    const cuisinePreference = preferences.cuisinePreferences?.find(
      pref => pref.cuisine === recipe.cuisine
    );
    if (cuisinePreference) {
      const cuisineBonus =
        {
          high: 1.0,
          medium: 0.5,
          low: 0.2,
        }[cuisinePreference.likeLevel] || 0;
      score += this.weights.cuisineMatch * cuisineBonus;
    }

    return score;
  }

  /**
   * Get filtered and ranked recipes for user
   * @param {string} userId User ID
   * @param {Object} options Query options
   * @returns {Promise<Object>} Filtered recipes and total count
   */
  async getFilteredRecipes(userId, { page = 1, limit = 20, category, searchQuery } = {}) {
    try {
      const db = getDb();

      // Get user preferences
      const preferences = await this.getPreferences(userId);
      if (!preferences) {
        // If no preferences, return unfiltered recipes
        return this.getUnfilteredRecipes({ page, limit, category, searchQuery });
      }

      // Base query
      const query = {};

      // Apply category filter
      if (category) {
        query.category = category;
      }

      // Apply search filter
      if (searchQuery) {
        query.$text = { $search: searchQuery };
      }

      // Apply dietary exclusions
      if (preferences.excludedDiets?.length > 0) {
        query.dietaryTags = {
          $not: {
            $in: preferences.excludedDiets,
          },
        };
      }

      // Apply allergen exclusions
      if (preferences.allergens?.length > 0) {
        query.allergens = {
          $not: {
            $in: preferences.allergens,
          },
        };
      }

      // Calculate skip value
      const skip = (page - 1) * limit;

      // Get recipes with scoring
      const [recipes, totalCount] = await Promise.all([
        db
          .collection('recipes')
          .aggregate([
            { $match: query },
            {
              $addFields: {
                score: {
                  $function: {
                    body: this.calculateRecipeScore.toString(),
                    args: ['$$ROOT', preferences],
                    lang: 'js',
                  },
                },
              },
            },
            { $sort: { score: -1 } },
            { $skip: skip },
            { $limit: limit },
          ])
          .toArray(),
        db.collection('recipes').countDocuments(query),
      ]);

      return {
        recipes,
        totalCount,
        currentPage: page,
        totalPages: Math.ceil(totalCount / limit),
      };
    } catch (error) {
      console.error('Error getting filtered recipes:', error);
      throw error;
    }
  }

  /**
   * Get unfiltered recipes
   * @param {Object} options Query options
   * @returns {Promise<Object>} Unfiltered recipes and total count
   */
  async getUnfilteredRecipes({ page = 1, limit = 20, category, searchQuery } = {}) {
    try {
      const db = getDb();

      // Base query
      const query = {};

      // Apply category filter
      if (category) {
        query.category = category;
      }

      // Apply search filter
      if (searchQuery) {
        query.$text = { $search: searchQuery };
      }

      // Calculate skip value
      const skip = (page - 1) * limit;

      // Get recipes
      const [recipes, totalCount] = await Promise.all([
        db
          .collection('recipes')
          .find(query)
          .sort({ popularity: -1 })
          .skip(skip)
          .limit(limit)
          .toArray(),
        db.collection('recipes').countDocuments(query),
      ]);

      return {
        recipes,
        totalCount,
        currentPage: page,
        totalPages: Math.ceil(totalCount / limit),
      };
    } catch (error) {
      console.error('Error getting unfiltered recipes:', error);
      throw error;
    }
  }

  /**
   * Invalidate user cache
   * @param {string} userId User ID
   * @returns {Promise<void>}
   */
  async invalidateUserCache(userId) {
    try {
      await Promise.all([
        this.redis.del(`${this.USER_PREFERENCES_CACHE_PREFIX}${userId}`),
        this.redis.del(`${this.FILTERED_RECIPES_CACHE_PREFIX}${userId}`),
      ]);
    } catch (error) {
      console.error('Error invalidating user cache:', error);
    }
  }
}

export default new RecipePreferenceManager();

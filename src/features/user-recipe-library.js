import { getDb } from '../config/db.js';
import { ObjectId } from 'mongodb';

class UserRecipeLibrary {
  /**
   * Save a recipe to user's library
   * @param {string} userId User ID
   * @param {string} recipeId Recipe ID
   * @returns {Promise<Object>} Saved recipe details
   */
  async saveRecipe(userId, recipeId) {
    try {
      const db = getDb();

      // Check if recipe exists
      const recipe = await db.collection('recipes').findOne({
        _id: new ObjectId(recipeId),
      });

      if (!recipe) {
        throw new Error('Recipe not found');
      }

      // Check if already saved
      const existingSave = await db.collection('savedRecipes').findOne({
        userId: new ObjectId(userId),
        recipeId: new ObjectId(recipeId),
      });

      if (existingSave) {
        throw new Error('Recipe already saved');
      }

      // Check user's subscription status and monthly save limit
      const user = await db.collection('users').findOne({
        _id: new ObjectId(userId),
      });

      if (!user.isPremium) {
        // Count saves in current month for free users
        const currentMonth = new Date();
        currentMonth.setDate(1);
        currentMonth.setHours(0, 0, 0, 0);

        const monthSaves = await db.collection('savedRecipes').countDocuments({
          userId: new ObjectId(userId),
          createdAt: { $gte: currentMonth },
        });

        if (monthSaves >= 5) {
          throw new Error('Monthly save limit reached. Upgrade to premium for unlimited saves!');
        }
      }

      const savedRecipe = {
        userId: new ObjectId(userId),
        recipeId: new ObjectId(recipeId),
        createdAt: new Date(),
        updatedAt: new Date(),
        isOfflineAvailable: false,
      };

      const result = await db.collection('savedRecipes').insertOne(savedRecipe);

      return {
        ...savedRecipe,
        _id: result.insertedId,
        recipe,
      };
    } catch (error) {
      console.error('Error saving recipe:', error);
      throw error;
    }
  }

  /**
   * Get user's saved recipes
   * @param {string} userId User ID
   * @param {Object} options Query options
   * @returns {Promise<Array>} List of saved recipes
   */
  async getSavedRecipes(userId, { page = 1, limit = 20 } = {}) {
    try {
      const db = getDb();
      const skip = (page - 1) * limit;

      return await db
        .collection('savedRecipes')
        .aggregate([
          {
            $match: {
              userId: new ObjectId(userId),
            },
          },
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
            $project: {
              createdAt: 1,
              isOfflineAvailable: 1,
              recipe: {
                _id: 1,
                title: 1,
                description: 1,
                averageRating: 1,
                reviewCount: 1,
                images: 1,
                tags: 1,
              },
            },
          },
          { $sort: { createdAt: -1 } },
          { $skip: skip },
          { $limit: limit },
        ])
        .toArray();
    } catch (error) {
      console.error('Error getting saved recipes:', error);
      throw error;
    }
  }

  /**
   * Remove a saved recipe
   * @param {string} userId User ID
   * @param {string} recipeId Recipe ID
   */
  async unsaveRecipe(userId, recipeId) {
    try {
      const db = getDb();

      const result = await db.collection('savedRecipes').deleteOne({
        userId: new ObjectId(userId),
        recipeId: new ObjectId(recipeId),
      });

      if (result.deletedCount === 0) {
        throw new Error('Recipe not found in saved recipes');
      }
    } catch (error) {
      console.error('Error removing saved recipe:', error);
      throw error;
    }
  }

  /**
   * Enable offline access for a recipe
   * @param {string} userId User ID
   * @param {string} recipeId Recipe ID
   * @returns {Promise<Object>} Updated saved recipe
   */
  async enableOfflineAccess(userId, recipeId) {
    try {
      const db = getDb();

      // Check if user is premium
      const user = await db.collection('users').findOne({
        _id: new ObjectId(userId),
      });

      if (!user.isPremium) {
        throw new Error('Offline access is a premium feature');
      }

      const result = await db.collection('savedRecipes').findOneAndUpdate(
        {
          userId: new ObjectId(userId),
          recipeId: new ObjectId(recipeId),
        },
        {
          $set: {
            isOfflineAvailable: true,
            updatedAt: new Date(),
          },
        },
        { returnDocument: 'after' }
      );

      if (!result.value) {
        throw new Error('Recipe not found in saved recipes');
      }

      return result.value;
    } catch (error) {
      console.error('Error enabling offline access:', error);
      throw error;
    }
  }

  /**
   * Get recipe data for offline access
   * @param {string} userId User ID
   * @param {string} recipeId Recipe ID
   * @returns {Promise<Object>} Complete recipe data for offline storage
   */
  async getOfflineRecipeData(userId, recipeId) {
    try {
      const db = getDb();

      // Check if user is premium and has offline access enabled
      const savedRecipe = await db.collection('savedRecipes').findOne({
        userId: new ObjectId(userId),
        recipeId: new ObjectId(recipeId),
        isOfflineAvailable: true,
      });

      if (!savedRecipe) {
        throw new Error('Recipe not available for offline access');
      }

      // Get complete recipe data
      const recipe = await db
        .collection('recipes')
        .aggregate([
          {
            $match: {
              _id: new ObjectId(recipeId),
            },
          },
          {
            $lookup: {
              from: 'reviews',
              localField: '_id',
              foreignField: 'recipeId',
              as: 'reviews',
            },
          },
        ])
        .next();

      if (!recipe) {
        throw new Error('Recipe not found');
      }

      return {
        ...recipe,
        offlineUpdatedAt: new Date(),
      };
    } catch (error) {
      console.error('Error getting offline recipe data:', error);
      throw error;
    }
  }
}

export default new UserRecipeLibrary();

import { getDb } from '../config/db.js';
import { ObjectId } from 'mongodb';

class SavedRecipeManager {
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
        _id: new ObjectId(recipeId)
      });

      if (!recipe) {
        throw new Error('Recipe not found');
      }

      // Save recipe if not already saved
      const savedRecipe = {
        userId: new ObjectId(userId),
        recipeId: new ObjectId(recipeId),
        createdAt: new Date()
      };

      await db.collection('savedRecipes').updateOne(
        {
          userId: new ObjectId(userId),
          recipeId: new ObjectId(recipeId)
        },
        {
          $setOnInsert: savedRecipe
        },
        { upsert: true }
      );

      return {
        ...savedRecipe,
        recipe
      };
    } catch (error) {
      console.error('Error saving recipe:', error);
      throw error;
    }
  }

  /**
   * Remove recipe from user's library
   * @param {string} userId User ID
   * @param {string} recipeId Recipe ID
   */
  async removeRecipe(userId, recipeId) {
    try {
      const db = getDb();

      // Remove recipe from saved recipes and all lists
      await Promise.all([
        db.collection('savedRecipes').deleteOne({
          userId: new ObjectId(userId),
          recipeId: new ObjectId(recipeId)
        }),
        db.collection('listRecipes').deleteMany({
          recipeId: new ObjectId(recipeId)
        })
      ]);

      // Update recipe counts for affected lists
      const affectedLists = await db.collection('listRecipes')
        .distinct('listId', {
          recipeId: new ObjectId(recipeId)
        });

      if (affectedLists.length > 0) {
        await db.collection('recipeLists').updateMany(
          { _id: { $in: affectedLists } },
          {
            $inc: { recipeCount: -1 },
            $set: { updatedAt: new Date() }
          }
        );
      }
    } catch (error) {
      console.error('Error removing recipe:', error);
      throw error;
    }
  }

  /**
   * Get user's saved recipes
   * @param {string} userId User ID
   * @param {Object} options Query options
   * @returns {Promise<Array>} Saved recipes
   */
  async getSavedRecipes(userId, { page = 1, limit = 20, sort = 'newest' } = {}) {
    try {
      const db = getDb();
      const skip = (page - 1) * limit;

      const sortOptions = {
        newest: { createdAt: -1 },
        oldest: { createdAt: 1 },
        nameAsc: { 'recipe.title': 1 },
        nameDesc: { 'recipe.title': -1 }
      };

      const recipes = await db.collection('savedRecipes')
        .aggregate([
          {
            $match: {
              userId: new ObjectId(userId)
            }
          },
          {
            $lookup: {
              from: 'recipes',
              localField: 'recipeId',
              foreignField: '_id',
              as: 'recipe'
            }
          },
          { $unwind: '$recipe' },
          // Get lists containing this recipe
          {
            $lookup: {
              from: 'listRecipes',
              let: { recipeId: '$recipeId' },
              pipeline: [
                {
                  $match: {
                    $expr: { $eq: ['$recipeId', '$$recipeId'] }
                  }
                },
                {
                  $lookup: {
                    from: 'recipeLists',
                    localField: 'listId',
                    foreignField: '_id',
                    as: 'list'
                  }
                },
                { $unwind: '$list' },
                {
                  $project: {
                    _id: '$list._id',
                    name: '$list.name'
                  }
                }
              ],
              as: 'lists'
            }
          },
          {
            $project: {
              _id: 0,
              savedRecipe: '$$ROOT',
              recipe: {
                _id: 1,
                title: 1,
                description: 1,
                images: 1,
                averageRating: 1,
                reviewCount: 1
              },
              lists: 1
            }
          },
          { $sort: sortOptions[sort] },
          { $skip: skip },
          { $limit: limit }
        ])
        .toArray();

      const total = await db.collection('savedRecipes').countDocuments({
        userId: new ObjectId(userId)
      });

      return {
        recipes,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      console.error('Error getting saved recipes:', error);
      throw error;
    }
  }

  /**
   * Check if recipe is saved
   * @param {string} userId User ID
   * @param {string} recipeId Recipe ID
   * @returns {Promise<Object>} Save status and lists
   */
  async getRecipeSaveStatus(userId, recipeId) {
    try {
      const db = getDb();

      const savedRecipe = await db.collection('savedRecipes')
        .aggregate([
          {
            $match: {
              userId: new ObjectId(userId),
              recipeId: new ObjectId(recipeId)
            }
          },
          {
            $lookup: {
              from: 'listRecipes',
              let: { recipeId: '$recipeId' },
              pipeline: [
                {
                  $match: {
                    $expr: { $eq: ['$recipeId', '$$recipeId'] }
                  }
                },
                {
                  $lookup: {
                    from: 'recipeLists',
                    localField: 'listId',
                    foreignField: '_id',
                    as: 'list'
                  }
                },
                { $unwind: '$list' },
                {
                  $project: {
                    _id: '$list._id',
                    name: '$list.name'
                  }
                }
              ],
              as: 'lists'
            }
          }
        ])
        .toArray();

      return {
        isSaved: savedRecipe.length > 0,
        lists: savedRecipe[0]?.lists || []
      };
    } catch (error) {
      console.error('Error getting recipe save status:', error);
      throw error;
    }
  }
}

export default new SavedRecipeManager(); 
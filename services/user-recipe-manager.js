import { getDb } from '../config/db.js';
import { ObjectId } from 'mongodb';

class UserRecipeManager {
  /**
   * Save a recipe for a user
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

      // Check if already saved
      const existingSave = await db.collection('savedRecipes').findOne({
        userId: new ObjectId(userId),
        recipeId: new ObjectId(recipeId)
      });

      if (existingSave) {
        throw new Error('Recipe already saved');
      }

      const savedRecipe = {
        userId: new ObjectId(userId),
        recipeId: new ObjectId(recipeId),
        savedAt: new Date()
      };

      await db.collection('savedRecipes').insertOne(savedRecipe);

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
   * Get user's saved recipes
   * @param {string} userId User ID
   * @returns {Promise<Array>} List of saved recipes
   */
  async getSavedRecipes(userId) {
    try {
      const db = getDb();
      
      return await db.collection('savedRecipes')
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
          {
            $project: {
              _id: 1,
              savedAt: 1,
              recipe: 1
            }
          },
          { $sort: { savedAt: -1 } }
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
        recipeId: new ObjectId(recipeId)
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
   * Create a meal plan
   * @param {Object} mealPlan Meal plan data
   * @returns {Promise<Object>} Created meal plan
   */
  async createMealPlan(mealPlan) {
    try {
      const db = getDb();
      
      const newMealPlan = {
        ...mealPlan,
        userId: new ObjectId(mealPlan.userId),
        recipes: mealPlan.recipes.map(recipe => ({
          ...recipe,
          recipeId: new ObjectId(recipe.recipeId)
        })),
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const result = await db.collection('mealPlans').insertOne(newMealPlan);
      return { ...newMealPlan, _id: result.insertedId };
    } catch (error) {
      console.error('Error creating meal plan:', error);
      throw error;
    }
  }

  /**
   * Get user's meal plans
   * @param {string} userId User ID
   * @returns {Promise<Array>} List of meal plans
   */
  async getMealPlans(userId) {
    try {
      const db = getDb();
      
      return await db.collection('mealPlans')
        .aggregate([
          { 
            $match: { 
              userId: new ObjectId(userId) 
            } 
          },
          {
            $lookup: {
              from: 'recipes',
              localField: 'recipes.recipeId',
              foreignField: '_id',
              as: 'recipeDetails'
            }
          },
          {
            $project: {
              _id: 1,
              title: 1,
              startDate: 1,
              endDate: 1,
              recipes: {
                $map: {
                  input: '$recipes',
                  as: 'recipe',
                  in: {
                    $mergeObjects: [
                      '$$recipe',
                      {
                        details: {
                          $arrayElemAt: [
                            {
                              $filter: {
                                input: '$recipeDetails',
                                cond: { $eq: ['$$this._id', '$$recipe.recipeId'] }
                              }
                            },
                            0
                          ]
                        }
                      }
                    ]
                  }
                }
              },
              createdAt: 1,
              updatedAt: 1
            }
          },
          { $sort: { startDate: -1 } }
        ])
        .toArray();
    } catch (error) {
      console.error('Error getting meal plans:', error);
      throw error;
    }
  }

  /**
   * Update a meal plan
   * @param {string} mealPlanId Meal plan ID
   * @param {Object} updates Updates to apply
   * @returns {Promise<Object>} Updated meal plan
   */
  async updateMealPlan(mealPlanId, updates) {
    try {
      const db = getDb();
      
      if (updates.recipes) {
        updates.recipes = updates.recipes.map(recipe => ({
          ...recipe,
          recipeId: new ObjectId(recipe.recipeId)
        }));
      }

      const result = await db.collection('mealPlans').findOneAndUpdate(
        { _id: new ObjectId(mealPlanId) },
        {
          $set: {
            ...updates,
            updatedAt: new Date()
          }
        },
        { returnDocument: 'after' }
      );

      if (!result.value) {
        throw new Error('Meal plan not found');
      }

      return result.value;
    } catch (error) {
      console.error('Error updating meal plan:', error);
      throw error;
    }
  }

  /**
   * Delete a meal plan
   * @param {string} userId User ID
   * @param {string} mealPlanId Meal plan ID
   */
  async deleteMealPlan(userId, mealPlanId) {
    try {
      const db = getDb();
      
      const result = await db.collection('mealPlans').deleteOne({
        _id: new ObjectId(mealPlanId),
        userId: new ObjectId(userId)
      });

      if (result.deletedCount === 0) {
        throw new Error('Meal plan not found');
      }
    } catch (error) {
      console.error('Error deleting meal plan:', error);
      throw error;
    }
  }
}

export default new UserRecipeManager(); 
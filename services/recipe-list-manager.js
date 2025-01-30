import { getDb } from '../config/db.js';
import { ObjectId } from 'mongodb';

class RecipeListManager {
  /**
   * Create a new recipe list
   * @param {string} userId User ID
   * @param {Object} listData List data
   * @returns {Promise<Object>} Created list
   */
  async createList(userId, { name, description = '' }) {
    try {
      const db = getDb();

      // Check for duplicate list name
      const existingList = await db.collection('recipeLists').findOne({
        userId: new ObjectId(userId),
        name: name
      });

      if (existingList) {
        throw new Error('A list with this name already exists');
      }

      const list = {
        userId: new ObjectId(userId),
        name,
        description,
        recipeCount: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const result = await db.collection('recipeLists').insertOne(list);

      return {
        ...list,
        _id: result.insertedId
      };
    } catch (error) {
      console.error('Error creating recipe list:', error);
      throw error;
    }
  }

  /**
   * Update a recipe list
   * @param {string} userId User ID
   * @param {string} listId List ID
   * @param {Object} updates Updates to apply
   * @returns {Promise<Object>} Updated list
   */
  async updateList(userId, listId, updates) {
    try {
      const db = getDb();

      if (updates.name) {
        // Check for duplicate list name
        const existingList = await db.collection('recipeLists').findOne({
          userId: new ObjectId(userId),
          name: updates.name,
          _id: { $ne: new ObjectId(listId) }
        });

        if (existingList) {
          throw new Error('A list with this name already exists');
        }
      }

      const result = await db.collection('recipeLists').findOneAndUpdate(
        {
          _id: new ObjectId(listId),
          userId: new ObjectId(userId)
        },
        {
          $set: {
            ...updates,
            updatedAt: new Date()
          }
        },
        { returnDocument: 'after' }
      );

      if (!result.value) {
        throw new Error('List not found');
      }

      return result.value;
    } catch (error) {
      console.error('Error updating recipe list:', error);
      throw error;
    }
  }

  /**
   * Delete a recipe list
   * @param {string} userId User ID
   * @param {string} listId List ID
   */
  async deleteList(userId, listId) {
    try {
      const db = getDb();

      // Delete list and its recipe associations
      await Promise.all([
        db.collection('recipeLists').deleteOne({
          _id: new ObjectId(listId),
          userId: new ObjectId(userId)
        }),
        db.collection('listRecipes').deleteMany({
          listId: new ObjectId(listId)
        })
      ]);
    } catch (error) {
      console.error('Error deleting recipe list:', error);
      throw error;
    }
  }

  /**
   * Get user's recipe lists
   * @param {string} userId User ID
   * @returns {Promise<Array>} List of recipe lists
   */
  async getUserLists(userId) {
    try {
      const db = getDb();

      return await db.collection('recipeLists')
        .find({
          userId: new ObjectId(userId)
        })
        .sort({ name: 1 })
        .toArray();
    } catch (error) {
      console.error('Error getting user lists:', error);
      throw error;
    }
  }

  /**
   * Add recipe to list
   * @param {string} userId User ID
   * @param {string} listId List ID
   * @param {string} recipeId Recipe ID
   * @returns {Promise<Object>} Added recipe details
   */
  async addRecipeToList(userId, listId, recipeId) {
    try {
      const db = getDb();

      // Check if list exists and belongs to user
      const list = await db.collection('recipeLists').findOne({
        _id: new ObjectId(listId),
        userId: new ObjectId(userId)
      });

      if (!list) {
        throw new Error('List not found');
      }

      // Check if recipe exists
      const recipe = await db.collection('recipes').findOne({
        _id: new ObjectId(recipeId)
      });

      if (!recipe) {
        throw new Error('Recipe not found');
      }

      // First ensure recipe is in user's library
      await db.collection('savedRecipes').updateOne(
        {
          userId: new ObjectId(userId),
          recipeId: new ObjectId(recipeId)
        },
        {
          $setOnInsert: {
            userId: new ObjectId(userId),
            recipeId: new ObjectId(recipeId),
            createdAt: new Date()
          }
        },
        { upsert: true }
      );

      // Add recipe to list if not already there
      const listRecipe = {
        listId: new ObjectId(listId),
        recipeId: new ObjectId(recipeId),
        createdAt: new Date()
      };

      await db.collection('listRecipes').updateOne(
        {
          listId: new ObjectId(listId),
          recipeId: new ObjectId(recipeId)
        },
        {
          $setOnInsert: listRecipe
        },
        { upsert: true }
      );

      // Update list recipe count
      await db.collection('recipeLists').updateOne(
        { _id: new ObjectId(listId) },
        {
          $inc: { recipeCount: 1 },
          $set: { updatedAt: new Date() }
        }
      );

      return {
        ...listRecipe,
        recipe
      };
    } catch (error) {
      console.error('Error adding recipe to list:', error);
      throw error;
    }
  }

  /**
   * Remove recipe from list
   * @param {string} userId User ID
   * @param {string} listId List ID
   * @param {string} recipeId Recipe ID
   */
  async removeRecipeFromList(userId, listId, recipeId) {
    try {
      const db = getDb();

      // Check if list exists and belongs to user
      const list = await db.collection('recipeLists').findOne({
        _id: new ObjectId(listId),
        userId: new ObjectId(userId)
      });

      if (!list) {
        throw new Error('List not found');
      }

      // Remove recipe from list
      const result = await db.collection('listRecipes').deleteOne({
        listId: new ObjectId(listId),
        recipeId: new ObjectId(recipeId)
      });

      if (result.deletedCount > 0) {
        // Update list recipe count
        await db.collection('recipeLists').updateOne(
          { _id: new ObjectId(listId) },
          {
            $inc: { recipeCount: -1 },
            $set: { updatedAt: new Date() }
          }
        );
      }
    } catch (error) {
      console.error('Error removing recipe from list:', error);
      throw error;
    }
  }

  /**
   * Get recipes in a list
   * @param {string} userId User ID
   * @param {string} listId List ID
   * @param {Object} options Query options
   * @returns {Promise<Array>} List recipes
   */
  async getListRecipes(userId, listId, { page = 1, limit = 20, sort = 'newest' } = {}) {
    try {
      const db = getDb();
      const skip = (page - 1) * limit;

      // Check if list exists and belongs to user
      const list = await db.collection('recipeLists').findOne({
        _id: new ObjectId(listId),
        userId: new ObjectId(userId)
      });

      if (!list) {
        throw new Error('List not found');
      }

      const sortOptions = {
        newest: { 'listRecipe.createdAt': -1 },
        oldest: { 'listRecipe.createdAt': 1 },
        nameAsc: { 'recipe.title': 1 },
        nameDesc: { 'recipe.title': -1 }
      };

      return await db.collection('listRecipes')
        .aggregate([
          {
            $match: {
              listId: new ObjectId(listId)
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
              _id: 0,
              listRecipe: '$$ROOT',
              recipe: {
                _id: 1,
                title: 1,
                description: 1,
                images: 1,
                averageRating: 1,
                reviewCount: 1
              }
            }
          },
          { $sort: sortOptions[sort] },
          { $skip: skip },
          { $limit: limit }
        ])
        .toArray();
    } catch (error) {
      console.error('Error getting list recipes:', error);
      throw error;
    }
  }

  /**
   * Move recipe between lists
   * @param {string} userId User ID
   * @param {string} recipeId Recipe ID
   * @param {string} fromListId Source list ID
   * @param {string} toListId Destination list ID
   */
  async moveRecipeBetweenLists(userId, recipeId, fromListId, toListId) {
    try {
      const db = getDb();

      // Check if both lists exist and belong to user
      const [fromList, toList] = await Promise.all([
        db.collection('recipeLists').findOne({
          _id: new ObjectId(fromListId),
          userId: new ObjectId(userId)
        }),
        db.collection('recipeLists').findOne({
          _id: new ObjectId(toListId),
          userId: new ObjectId(userId)
        })
      ]);

      if (!fromList || !toList) {
        throw new Error('One or both lists not found');
      }

      // Move recipe
      await Promise.all([
        this.removeRecipeFromList(userId, fromListId, recipeId),
        this.addRecipeToList(userId, toListId, recipeId)
      ]);
    } catch (error) {
      console.error('Error moving recipe between lists:', error);
      throw error;
    }
  }
}

export default new RecipeListManager(); 
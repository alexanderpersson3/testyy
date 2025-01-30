import { getDb } from '../../config/db.js';
import { ObjectId } from 'mongodb';
import { GoogleGenerativeAI } from '@google/generative-ai';

class RecipeManager {
  constructor() {
    // Initialize Google Gemini API
    this.genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY);
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-pro' });
  }

  /**
   * Create a new recipe from admin panel
   * @param {Object} recipeData Recipe data
   * @param {string} adminId Admin ID
   * @returns {Promise<Object>} Created recipe
   */
  async createRecipe(recipeData, adminId) {
    try {
      const db = getDb();
      const now = new Date();

      const recipe = {
        ...recipeData,
        isOfficial: true,
        createdAt: now,
        updatedAt: now,
        createdBy: new ObjectId(adminId),
        status: 'published'
      };

      const result = await db.collection('recipes').insertOne(recipe);
      return { ...recipe, _id: result.insertedId };
    } catch (error) {
      console.error('Error creating recipe:', error);
      throw error;
    }
  }

  /**
   * Import and parse recipe using AI
   * @param {string} content Raw recipe content
   * @returns {Promise<Object>} Parsed recipe data
   */
  async importRecipeWithAI(content) {
    try {
      const prompt = `
        Parse this recipe content and extract the following information in JSON format:
        - title: The recipe title
        - description: Brief description
        - servings: Number of servings
        - prepTime: Preparation time in minutes
        - cookTime: Cooking time in minutes
        - ingredients: Array of objects with { name, amount, unit }
        - instructions: Array of step-by-step instructions
        - tags: Array of relevant tags (dietary, cuisine type, etc.)
        
        Recipe content:
        ${content}
      `;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      // Parse the JSON response
      const parsedRecipe = JSON.parse(text);

      // Validate the parsed data
      if (!this.validateParsedRecipe(parsedRecipe)) {
        throw new Error('Invalid recipe format from AI');
      }

      return parsedRecipe;
    } catch (error) {
      console.error('Error importing recipe with AI:', error);
      throw error;
    }
  }

  /**
   * Schedule a recipe
   * @param {string} recipeId Recipe ID
   * @param {Date} date Scheduled date
   * @param {string} category Optional category
   * @param {number} priorityOrder Optional priority order
   * @returns {Promise<Object>} Created schedule
   */
  async scheduleRecipe(recipeId, date, category = null, priorityOrder = 0) {
    try {
      const db = getDb();
      const now = new Date();

      const schedule = {
        recipeId: new ObjectId(recipeId),
        date: new Date(date),
        category,
        priorityOrder,
        createdAt: now,
        updatedAt: now
      };

      const result = await db.collection('recipe_schedules').insertOne(schedule);
      return { ...schedule, _id: result.insertedId };
    } catch (error) {
      console.error('Error scheduling recipe:', error);
      throw error;
    }
  }

  /**
   * Get scheduled recipes for a date range
   * @param {Date} startDate Start date
   * @param {Date} endDate End date
   * @returns {Promise<Array>} Scheduled recipes
   */
  async getScheduledRecipes(startDate, endDate) {
    try {
      const db = getDb();

      const schedules = await db.collection('recipe_schedules')
        .aggregate([
          {
            $match: {
              date: {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
              }
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
          {
            $unwind: '$recipe'
          },
          {
            $sort: {
              date: 1,
              priorityOrder: 1
            }
          }
        ])
        .toArray();

      return schedules;
    } catch (error) {
      console.error('Error getting scheduled recipes:', error);
      throw error;
    }
  }

  /**
   * Remove a recipe schedule
   * @param {string} scheduleId Schedule ID
   * @returns {Promise<boolean>} Success status
   */
  async removeSchedule(scheduleId) {
    try {
      const db = getDb();

      const result = await db.collection('recipe_schedules').deleteOne({
        _id: new ObjectId(scheduleId)
      });

      return result.deletedCount === 1;
    } catch (error) {
      console.error('Error removing recipe schedule:', error);
      throw error;
    }
  }

  /**
   * Validate parsed recipe data from AI
   * @param {Object} recipe Parsed recipe data
   * @returns {boolean} Validation result
   */
  validateParsedRecipe(recipe) {
    return (
      recipe.title &&
      recipe.description &&
      Array.isArray(recipe.ingredients) &&
      recipe.ingredients.length > 0 &&
      Array.isArray(recipe.instructions) &&
      recipe.instructions.length > 0
    );
  }
}

export default new RecipeManager(); 
import { getDb } from '../config/db.js';
import { ObjectId } from 'mongodb';

class NutritionCalculator {
  constructor() {
    this.defaultNutritionPer100g = {
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      fiber: 0,
      sugar: 0,
    };
  }

  /**
   * Calculate nutrition information for a recipe per person
   * @param {string} recipeId - The recipe ID
   * @returns {Promise<Object>} Nutrition information and missing ingredients
   */
  async calculateRecipeNutrition(recipeId) {
    try {
      const db = getDb();

      // Get recipe details
      const recipe = await db.collection('recipes').findOne({
        _id: new ObjectId(recipeId),
      });

      if (!recipe) {
        throw new Error('Recipe not found');
      }

      const servings = recipe.servings || 1;
      const totalNutrition = { ...this.defaultNutritionPer100g };
      const missingNutritionInfo = [];

      // Process each ingredient
      for (const ingredient of recipe.ingredients) {
        const ingredientDoc = await db.collection('ingredients').findOne({
          name: { $regex: new RegExp(ingredient.name, 'i') },
        });

        if (!ingredientDoc || !ingredientDoc.nutritionalInfo) {
          missingNutritionInfo.push(ingredient.name);
          continue;
        }

        // Convert ingredient amount to grams for calculation
        const grams = await this.convertToGrams(ingredient.amount, ingredient.unit);

        // Calculate nutrition based on the ingredient amount
        const nutritionMultiplier = grams / 100; // nutritionalInfo is per 100g
        Object.keys(this.defaultNutritionPer100g).forEach(nutrient => {
          const nutrientValue = ingredientDoc.nutritionalInfo[nutrient] || 0;
          totalNutrition[nutrient] += nutrientValue * nutritionMultiplier;
        });
      }

      // Calculate per person values
      const nutritionPerPerson = {};
      Object.keys(totalNutrition).forEach(nutrient => {
        nutritionPerPerson[nutrient] = Math.round(totalNutrition[nutrient] / servings);
      });

      return {
        servings,
        nutritionPerPerson,
        totalNutrition,
        missingNutritionInfo: missingNutritionInfo.length > 0 ? missingNutritionInfo : null,
      };
    } catch (error) {
      console.error('Error calculating recipe nutrition:', error);
      throw error;
    }
  }

  /**
   * Convert various units to grams
   * @param {number} amount - The amount in original unit
   * @param {string} unit - The original unit
   * @returns {Promise<number>} Amount in grams
   */
  async convertToGrams(amount, unit) {
    // Common conversion factors
    const conversions = {
      g: 1,
      kg: 1000,
      mg: 0.001,
      oz: 28.3495,
      lb: 453.592,
      ml: 1, // Assuming density of water for liquids
      l: 1000,
      tbsp: 15,
      tsp: 5,
      cup: 240,
      piece: 100, // Rough estimate, should be refined per ingredient
      slice: 30, // Rough estimate, should be refined per ingredient
    };

    const normalizedUnit = unit.toLowerCase().replace('.', '');
    const conversionFactor = conversions[normalizedUnit];

    if (!conversionFactor) {
      console.warn(`Unknown unit ${unit}, using default conversion factor of 1`);
      return amount;
    }

    return amount * conversionFactor;
  }
}

export default new NutritionCalculator();

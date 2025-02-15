import { getDb } from '../config/db.js';
import { ObjectId } from 'mongodb';
import OpenAI from 'openai';

class RecipeDifficultyClassifier {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // Keywords indicating complexity
    this.complexityKeywords = {
      easy: ['simple', 'quick', 'basic', 'beginner', 'straightforward'],
      medium: ['intermediate', 'moderate', 'marinate', 'bake', 'roast'],
      hard: [
        'advanced',
        'complex',
        'challenging',
        'professional',
        'sous vide',
        'temper',
        'proof',
        'knead',
        'caramelize',
        'ferment',
        'cure',
        'smoke',
        'confit',
      ],
    };
  }

  /**
   * Classify recipe difficulty using rule-based approach
   * @param {Object} recipe Recipe object
   * @returns {string} Difficulty level
   */
  classifyWithRules(recipe) {
    try {
      let score = 0;

      // Factor 1: Number of ingredients
      const ingredientCount = recipe.ingredients.length;
      if (ingredientCount <= 5) score += 1;
      else if (ingredientCount <= 10) score += 2;
      else score += 3;

      // Factor 2: Total time
      const totalTime = (recipe.prepTime || 0) + (recipe.cookTime || 0);
      if (totalTime <= 30) score += 1;
      else if (totalTime <= 60) score += 2;
      else score += 3;

      // Factor 3: Number of steps
      const stepCount = recipe.instructions.length;
      if (stepCount <= 5) score += 1;
      else if (stepCount <= 10) score += 2;
      else score += 3;

      // Factor 4: Keyword analysis
      const allText =
        `${recipe.title} ${recipe.description} ${recipe.instructions.join(' ')}`.toLowerCase();

      let keywordScore = 0;
      for (const [level, keywords] of Object.entries(this.complexityKeywords)) {
        for (const keyword of keywords) {
          if (allText.includes(keyword)) {
            keywordScore += level === 'easy' ? 1 : level === 'medium' ? 2 : 3;
            break;
          }
        }
      }
      score += Math.round(keywordScore / 2); // Weight keyword score less

      // Calculate final difficulty
      if (score <= 6) return 'Easy';
      if (score <= 9) return 'Medium';
      return 'Hard';
    } catch (error) {
      console.error('Error in rule-based classification:', error);
      return 'Medium'; // Default to medium if classification fails
    }
  }

  /**
   * Classify recipe difficulty using AI
   * @param {Object} recipe Recipe object
   * @returns {Promise<string>} Difficulty level
   */
  async classifyWithAI(recipe) {
    try {
      const prompt = `Analyze this recipe and classify its difficulty as Easy, Medium, or Hard. Consider the number of ingredients (${recipe.ingredients.length}), preparation time (${recipe.prepTime} minutes), cooking time (${recipe.cookTime} minutes), and the complexity of instructions.

Recipe Title: ${recipe.title}
Description: ${recipe.description}
Instructions:
${recipe.instructions.join('\n')}

Respond with ONLY ONE WORD: Easy, Medium, or Hard.`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content:
              'You are a professional chef who classifies recipe difficulty levels. Respond with exactly one word: Easy, Medium, or Hard.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        max_tokens: 10,
        temperature: 0.3,
      });

      const difficulty = response.choices[0].message.content.trim();
      if (['Easy', 'Medium', 'Hard'].includes(difficulty)) {
        return difficulty;
      }

      // Fallback to rule-based if AI response is invalid
      return this.classifyWithRules(recipe);
    } catch (error) {
      console.error('Error in AI classification:', error);
      // Fallback to rule-based on error
      return this.classifyWithRules(recipe);
    }
  }

  /**
   * Classify recipe difficulty and update the database
   * @param {string} recipeId Recipe ID
   * @param {boolean} useAI Whether to use AI classification
   * @returns {Promise<string>} Difficulty level
   */
  async classifyRecipe(recipeId, useAI = false) {
    try {
      const db = getDb();

      // Get recipe
      const recipe = await db.collection('recipes').findOne({
        _id: new ObjectId(recipeId),
      });

      if (!recipe) {
        throw new Error('Recipe not found');
      }

      // Classify difficulty
      const difficulty = useAI ? await this.classifyWithAI(recipe) : this.classifyWithRules(recipe);

      // Update recipe with difficulty
      await db.collection('recipes').updateOne(
        { _id: new ObjectId(recipeId) },
        {
          $set: {
            difficulty,
            updatedAt: new Date(),
          },
        }
      );

      return difficulty;
    } catch (error) {
      console.error('Error classifying recipe:', error);
      throw error;
    }
  }

  /**
   * Bulk classify recipes without difficulty
   * @param {boolean} useAI Whether to use AI classification
   * @returns {Promise<number>} Number of recipes classified
   */
  async bulkClassifyRecipes(useAI = false) {
    try {
      const db = getDb();
      const recipes = await db
        .collection('recipes')
        .find({ difficulty: { $exists: false } })
        .toArray();

      let classified = 0;
      for (const recipe of recipes) {
        try {
          await this.classifyRecipe(recipe._id.toString(), useAI);
          classified++;
        } catch (error) {
          console.error(`Error classifying recipe ${recipe._id}:`, error);
          continue;
        }
      }

      return classified;
    } catch (error) {
      console.error('Error in bulk classification:', error);
      throw error;
    }
  }
}

export default new RecipeDifficultyClassifier();

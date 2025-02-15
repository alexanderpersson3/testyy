import { getDb } from '../config/db.js';
import { Configuration, OpenAIApi } from 'openai';

class TagGenerator {
  constructor() {
    // Initialize OpenAI client
    const configuration = new Configuration({
      apiKey: process.env.OPENAI_API_KEY,
    });
    this.openai = new OpenAIApi(configuration);

    // Common tag categories
    this.tagCategories = {
      cuisine: ['Italian', 'Swedish', 'Asian', 'Mediterranean', 'Mexican'],
      dietaryRestrictions: ['Vegetarian', 'Vegan', 'Gluten-Free', 'Dairy-Free'],
      mealType: ['Breakfast', 'Lunch', 'Dinner', 'Snack', 'Dessert'],
      cookingMethod: ['Baked', 'Grilled', 'Fried', 'Slow-Cooked', 'Raw'],
      difficulty: ['Easy', 'Intermediate', 'Advanced'],
      timeRequired: ['Quick', '30-Minutes', 'Weekend-Project'],
    };
  }

  /**
   * Generate tags for a recipe using LLM
   * @param {Object} recipeData Recipe data
   * @returns {Promise<Array>} Generated tags
   */
  async generateTags(recipeData) {
    try {
      const db = getDb();

      // First try LLM-based tag generation
      try {
        const tags = await this.generateTagsWithLLM(recipeData);
        return await this.saveAndReturnTags(tags);
      } catch (llmError) {
        console.error('LLM tag generation failed:', llmError);
        // Fallback to rule-based generation
        const tags = await this.generateTagsWithRules(recipeData);
        return await this.saveAndReturnTags(tags);
      }
    } catch (error) {
      console.error('Error generating tags:', error);
      throw error;
    }
  }

  /**
   * Generate tags using OpenAI
   * @param {Object} recipeData Recipe data
   * @returns {Promise<Array>} Generated tags
   */
  async generateTagsWithLLM(recipeData) {
    const prompt = `Generate relevant tags for this recipe. Consider cuisine type, dietary restrictions, cooking method, and difficulty level.
Recipe Title: ${recipeData.title}
Ingredients: ${recipeData.ingredients.map(i => i.name).join(', ')}
Instructions: ${recipeData.instructions}

Return only the tags as a comma-separated list.`;

    const response = await this.openai.createCompletion({
      model: 'text-davinci-003',
      prompt,
      max_tokens: 100,
      temperature: 0.5,
    });

    const tags = response.data.choices[0].text
      .split(',')
      .map(tag => tag.trim())
      .filter(tag => tag.length > 0);

    return this.validateAndNormalizeTags(tags);
  }

  /**
   * Generate tags using rule-based system (fallback)
   * @param {Object} recipeData Recipe data
   * @returns {Promise<Array>} Generated tags
   */
  async generateTagsWithRules(recipeData) {
    const tags = new Set();

    // Check ingredients for dietary restrictions
    const ingredients = recipeData.ingredients.map(i => i.name.toLowerCase());
    if (!ingredients.some(i => ['meat', 'chicken', 'fish'].includes(i))) {
      tags.add('Vegetarian');
    }
    if (!ingredients.some(i => ['milk', 'cheese', 'cream', 'butter', 'egg'].includes(i))) {
      tags.add('Vegan');
    }
    if (!ingredients.some(i => ['flour', 'bread', 'pasta'].includes(i))) {
      tags.add('Gluten-Free');
    }

    // Check cooking time
    const totalTime = recipeData.prepTime + recipeData.cookTime;
    if (totalTime <= 30) {
      tags.add('Quick');
      tags.add('30-Minutes');
    }

    // Check cooking method from instructions
    const instructions = recipeData.instructions.toLowerCase();
    if (instructions.includes('bake')) tags.add('Baked');
    if (instructions.includes('grill')) tags.add('Grilled');
    if (instructions.includes('fry')) tags.add('Fried');
    if (instructions.includes('slow cook')) tags.add('Slow-Cooked');

    return Array.from(tags);
  }

  /**
   * Validate and normalize tags
   * @param {Array} tags Raw tags
   * @returns {Array} Normalized tags
   */
  validateAndNormalizeTags(tags) {
    const normalizedTags = new Set();
    const allValidTags = Object.values(this.tagCategories).flat();

    for (const tag of tags) {
      // Find the closest matching valid tag
      const matchingTag = allValidTags.find(
        validTag => validTag.toLowerCase() === tag.toLowerCase()
      );

      if (matchingTag) {
        normalizedTags.add(matchingTag);
      }
    }

    return Array.from(normalizedTags);
  }

  /**
   * Save tags to database and return them
   * @param {Array} tags Tags to save
   * @returns {Promise<Array>} Saved tags
   */
  async saveAndReturnTags(tags) {
    const db = getDb();
    const savedTags = [];

    for (const tagName of tags) {
      // Find or create tag
      const result = await db.collection('tags').findOneAndUpdate(
        { name: tagName },
        {
          $setOnInsert: {
            name: tagName,
            createdAt: new Date(),
          },
        },
        {
          upsert: true,
          returnDocument: 'after',
        }
      );

      savedTags.push(result.value);
    }

    return savedTags;
  }

  /**
   * Get tag suggestions for a recipe
   * @param {string} query Partial tag name
   * @returns {Promise<Array>} Matching tags
   */
  async getTagSuggestions(query) {
    try {
      const db = getDb();

      return await db
        .collection('tags')
        .find({
          name: {
            $regex: new RegExp(query, 'i'),
          },
        })
        .sort({ name: 1 })
        .limit(10)
        .toArray();
    } catch (error) {
      console.error('Error getting tag suggestions:', error);
      throw error;
    }
  }
}

export default new TagGenerator();

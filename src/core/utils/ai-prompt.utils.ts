import type { AIRecipeRequest } from '../services/ai.service.js';

/**
 * Utility class for AI prompt generation and management
 */
export class AIPromptUtils {
  /**
   * Builds a recipe generation prompt
   * @param request - Recipe generation request
   * @returns Formatted prompt string
   */
  static buildRecipePrompt(request: AIRecipeRequest): string {
    let prompt = `Create a recipe using these ingredients: ${request.ingredients.join(', ')}.\n\n`;

    if (request.preferences) {
      if (request.preferences.cuisine) {
        prompt += `Cuisine style: ${request.preferences.cuisine}\n`;
      }
      if (request.preferences.dietary?.length) {
        prompt += `Dietary requirements: ${request.preferences.dietary.join(', ')}\n`;
      }
      if (request.preferences.difficulty) {
        prompt += `Difficulty level: ${request.preferences.difficulty}\n`;
      }
      if (request.preferences.maxTime) {
        prompt += `Maximum cooking time: ${request.preferences.maxTime} minutes\n`;
      }
    }

    return prompt;
  }

  /**
   * Builds the complete prompt text with formatting instructions
   * @param prompt - Base prompt content
   * @returns Complete formatted prompt text
   */
  static buildPromptText(prompt: string): string {
    return `You are a professional chef who specializes in creating recipes based on available ingredients.

${prompt}

Please provide the recipe in a structured format that I can parse programmatically. Use these exact section headers:
TITLE:
DESCRIPTION:
INGREDIENTS:
INSTRUCTIONS:

For ingredients, use the format: "amount unit ingredient_name" (e.g., "2 cups flour")
For instructions, use numbered steps (e.g., "1. Preheat the oven to 350°F")`;
  }

  /**
   * Suggests alternative ingredients based on recipe context
   * @param request - Recipe generation request
   * @returns Array of alternative suggestions
   */
  static suggestAlternatives(request: AIRecipeRequest): string[] {
    const suggestions: string[] = [];

    // Suggest adding herbs or spices
    suggestions.push('Try adding herbs like basil or thyme');
    suggestions.push('Consider using different spices');

    // Suggest ingredient substitutions based on cuisine
    if (request.preferences?.cuisine) {
      switch (request.preferences.cuisine.toLowerCase()) {
        case 'italian':
          suggestions.push('Try adding Italian herbs like oregano or rosemary');
          suggestions.push('Consider using fresh mozzarella');
          break;
        case 'asian':
          suggestions.push('Try adding ginger or lemongrass');
          suggestions.push('Consider using sesame oil');
          break;
        case 'mexican':
          suggestions.push('Try adding cilantro or lime');
          suggestions.push('Consider using different chili peppers');
          break;
      }
    }

    // Suggest based on dietary preferences
    if (request.preferences?.dietary?.includes('vegetarian')) {
      suggestions.push('Try adding plant-based proteins like tofu or tempeh');
      suggestions.push('Consider using nutritional yeast for umami flavor');
    }

    return suggestions;
  }

  /**
   * Calculates confidence score for generated recipe
   * @param recipe - Generated recipe
   * @param request - Original recipe request
   * @returns Confidence score between 0 and 1
   */
  static calculateConfidence(recipe: Partial<any>, request: AIRecipeRequest): number {
    let confidence = 1.0;

    // Reduce confidence if we couldn't use all ingredients
    const usedIngredients = new Set(recipe.ingredients?.map((i: any) => i.name.toLowerCase()));
    const requestedIngredients = new Set(request.ingredients.map(i => i.toLowerCase()));
    const unusedCount = Array.from(requestedIngredients).filter(
      i => !usedIngredients.has(i)
    ).length;
    confidence *= 1 - (unusedCount / requestedIngredients.size) * 0.5;

    // Reduce confidence if recipe is too simple
    if (recipe.instructions && recipe.instructions.length < 3) {
      confidence *= 0.8;
    }

    // Reduce confidence if instructions are too vague
    const avgInstructionLength =
      recipe.instructions?.reduce((sum: number, i: any) => sum + i.text.length, 0) || 0;
    if (
      avgInstructionLength > 0 &&
      avgInstructionLength / (recipe.instructions?.length || 1) < 20
    ) {
      confidence *= 0.9;
    }

    // Reduce confidence if no durations or temperatures are found
    const hasTemperature = recipe.instructions?.some((i: any) => i.timer);
    const hasDuration = recipe.instructions?.some((i: any) => i.timer);
    if (!hasTemperature && !hasDuration) {
      confidence *= 0.9;
    }

    // Reduce confidence if preferences are not met
    if (request.preferences) {
      if (
        request.preferences.cuisine &&
        !recipe.title?.toLowerCase().includes(request.preferences.cuisine.toLowerCase())
      ) {
        confidence *= 0.9;
      }
      if (request.preferences.maxTime) {
        const totalTime = (recipe.prepTime || 0) + (recipe.cookTime || 0);
        if (totalTime > request.preferences.maxTime) {
          confidence *= 0.8;
        }
      }
    }

    return Math.max(0, Math.min(1, confidence));
  }
} 
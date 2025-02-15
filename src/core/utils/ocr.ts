import type { Recipe } from '../types/express.js';
import { createWorker } from 'tesseract.js';;
import logger from '../utils/logger.js';

export interface OCRResult {
  text: string;
  confidence: number;
}

export async function parseRecipeFromImage(imagePath: string): Promise<Partial<Recipe>> {
  try {
    const worker = await createWorker();
    await worker.loadLanguage('eng');
    await worker.initialize('eng');
    const { data } = await worker.recognize(Buffer.from(imagePath));
    await worker.terminate();

    // Basic recipe structure extraction
    const recipe: Partial<Recipe> = {
      title: extractTitle(data.text),
      description: extractDescription(data.text),
      ingredients: extractIngredients(data.text),
      instructions: extractInstructions(data.text),
      prepTime: extractPrepTime(data.text),
      cookTime: extractCookTime(data.text),
      servings: extractServings(data.text),
    };

    return recipe;
  } catch (error) {
    logger.error('Error parsing recipe from image:', error);
    throw new Error('Failed to parse recipe from image');
  }
}

function extractTitle(text: string): string {
  // Extract first line as title
  const lines = text.split('\n');
  return lines[0].trim();
}

function extractDescription(text: string): string {
  // Look for description section
  const descriptionMatch = text.match(/Description:?\s*(.*?)(?=Ingredients:|$)/is);
  return descriptionMatch ? descriptionMatch[1].trim() : '';
}

function extractIngredients(text: string): Array<{ name: string; amount: number; unit: string }> {
  const ingredients: Array<{ name: string; amount: number; unit: string }> = [];
  const ingredientsMatch = text.match(/Ingredients:?\s*(.*?)(?=Instructions:|$)/is);

  if (ingredientsMatch) {
    const ingredientsList = ingredientsMatch[1].split('\n');
    ingredientsList.forEach(line => {
      const match = line.match(/(\d+(?:\.\d+)?)\s*(\w+)\s+(.+)/);
      if (match) {
        ingredients.push({
          amount: parseFloat(match[1]),
          unit: match[2],
          name: match[3].trim(),
        });
      }
    });
  }

  return ingredients;
}

function extractInstructions(text: string): Array<{ step: number; text: string }> {
  const instructions: Array<{ step: number; text: string }> = [];
  const instructionsMatch = text.match(/Instructions:?\s*(.*?)(?=Notes:|$)/is);

  if (instructionsMatch) {
    const instructionsList = instructionsMatch[1].split('\n');
    let step = 1;
    instructionsList.forEach(line => {
      const trimmedLine = line.trim();
      if (trimmedLine) {
        // Remove leading numbers if present
        const instructionText = trimmedLine.replace(/^\d+\.\s*/, '');
        instructions.push({
          step,
          text: instructionText,
        });
        step++;
      }
    });
  }

  return instructions;
}

function extractPrepTime(text: string): number {
  const prepTimeMatch = text.match(/Prep(?:aration)? Time:?\s*(\d+)/i);
  return prepTimeMatch ? parseInt(prepTimeMatch[1]) : 0;
}

function extractCookTime(text: string): number {
  const cookTimeMatch = text.match(/Cook(?:ing)? Time:?\s*(\d+)/i);
  return cookTimeMatch ? parseInt(cookTimeMatch[1]) : 0;
}

function extractServings(text: string): number {
  const servingsMatch = text.match(/Servings:?\s*(\d+)/i);
  return servingsMatch ? parseInt(servingsMatch[1]) : 0;
}

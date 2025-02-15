import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import { ObjectId } from 'mongodb';
import type { Recipe, CreateRecipeDTO, Difficulty } from '../types/recipe.js';
import type { MongoFilter, MongoUpdate } from '../types/mongodb.js';
import { MongoWriteError, MongoQueryError } from '../types/mongodb-errors.js';
import { ValidationError } from '../types/validation-errors.js';
import { DatabaseService } from '../db/database.service.js';
import logger from '../utils/logger.js';
import { RecipeParserUtils } from '../utils/recipe-parser.utils.js';
import { AIPromptUtils } from '../utils/ai-prompt.utils.js';

/**
 * Interface for AI recipe generation request
 */
export interface AIRecipeRequest {
  ingredients: string[];
  preferences?: {
    cuisine?: string;
    dietary?: string[];
    difficulty?: Difficulty;
    maxTime?: number;
  };
}

/**
 * Interface for AI recipe generation response
 */
export interface AIRecipeResponse {
  recipe: Partial<CreateRecipeDTO>;
  confidence: number;
  alternatives?: string[];
}

/**
 * Interface for AI recipe generation log
 */
export interface AIRecipeLog {
  _id: ObjectId;
  timestamp: Date;
  request: AIRecipeRequest;
  recipe: Partial<CreateRecipeDTO>;
  success: boolean;
  model: string;
  error?: string;
}

export class AIServiceError extends Error {
  constructor(message: string, public readonly details?: unknown) {
    super(message);
    this.name = 'AIServiceError';
  }
}

export class AIGenerationError extends AIServiceError {
  constructor(message: string, details?: unknown) {
    super(`AI Generation failed: ${message}`, details);
    this.name = 'AIGenerationError';
  }
}

export class AIParsingError extends AIServiceError {
  constructor(message: string, details?: unknown) {
    super(`AI Response parsing failed: ${message}`, details);
    this.name = 'AIParsingError';
  }
}

/**
 * Service for AI-powered recipe generation and management.
 * Uses Google's Generative AI to create recipes from ingredients and preferences.
 */
export class AIService {
  private static instance: AIService;
  private model: GenerativeModel;
  private db: DatabaseService;
  private initialized: boolean = false;

  private constructor() {
    const apiKey = process.env.GOOGLE_AI_API_KEY;
    if (!apiKey) {
      throw new Error('GOOGLE_AI_API_KEY environment variable is not set');
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    this.model = genAI.getGenerativeModel({ model: 'gemini-pro' });
    this.db = DatabaseService.getInstance();
  }

  /**
   * Gets the singleton instance of AIService.
   * @returns The AIService instance
   */
  static getInstance(): AIService {
    if (!AIService.instance) {
      AIService.instance = new AIService();
    }
    return AIService.instance;
  }

  private async initialize() {
    if (this.initialized) return;

    try {
      await this.db.connect();
      this.initialized = true;
    } catch (error) {
      logger.error('Failed to initialize AIService:', error);
      throw new MongoQueryError('Failed to initialize AIService', error);
    }
  }

  private async ensureInitialized() {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  /**
   * Generates a recipe based on provided ingredients and preferences.
   * @param request - The recipe generation request containing ingredients and preferences
   * @returns A promise resolving to the generated recipe with confidence score
   * @throws {ValidationError} If the request is invalid
   * @throws {AIGenerationError} If AI generation fails
   * @throws {AIParsingError} If parsing the AI response fails
   */
  async generateRecipe(request: AIRecipeRequest): Promise<AIRecipeResponse> {
    try {
      await this.ensureInitialized();

      // Validate input
      if (!request.ingredients || request.ingredients.length === 0) {
        throw new ValidationError('No ingredients provided');
      }

      // Filter out empty ingredients and trim whitespace
      request.ingredients = request.ingredients.map(i => i.trim()).filter(i => i.length > 0);

      if (request.ingredients.length === 0) {
        throw new ValidationError('No valid ingredients provided');
      }

      const prompt = AIPromptUtils.buildRecipePrompt(request);

      let result;
      try {
        result = await this.model.generateContent({
          contents: [
            {
              role: 'user',
              parts: [{ text: AIPromptUtils.buildPromptText(prompt) }],
            },
          ],
        });
      } catch (error) {
        throw new AIGenerationError(
          'Failed to generate recipe from AI model',
          error instanceof Error ? error.message : error
        );
      }

      const response = await result.response;
      const recipeText = response.text();

      if (!recipeText) {
        throw new AIGenerationError('Empty response from AI model');
      }

      let recipe;
      try {
        recipe = await this.parseRecipeResponse(recipeText);
      } catch (error) {
        throw new AIParsingError(
          'Failed to parse AI response',
          error instanceof Error ? error.message : error
        );
      }

      // Calculate confidence and alternatives
      const confidence = AIPromptUtils.calculateConfidence(recipe, request);
      const alternatives = AIPromptUtils.suggestAlternatives(request);

      // Create final recipe with defaults
      const finalRecipe = {
        ...recipe,
        difficulty: request.preferences?.difficulty || 'medium',
        prepTime: request.preferences?.maxTime ? Math.floor(request.preferences.maxTime * 0.3) : 15,
        cookTime: request.preferences?.maxTime ? Math.floor(request.preferences.maxTime * 0.7) : 30,
        servings: 4,
      };

      // Log the generation for analytics
      await this.logRecipeGeneration(request, finalRecipe, true);

      return {
        recipe: finalRecipe,
        confidence,
        alternatives,
      };
    } catch (error) {
      // Log the error but still log the generation attempt
      logger.error('Failed to generate recipe:', error);
      
      if (error instanceof ValidationError || 
          error instanceof AIGenerationError || 
          error instanceof AIParsingError) {
        await this.logRecipeGeneration(request, {}, false, error.message);
        throw error;
      }

      const unknownError = new AIServiceError(
        'Unexpected error during recipe generation',
        error instanceof Error ? error.message : error
      );
      await this.logRecipeGeneration(request, {}, false, unknownError.message);
      throw unknownError;
    }
  }

  /**
   * Parses the AI model's response into a structured recipe format.
   * @param text - Raw text response from the AI model
   * @returns Parsed recipe data
   * @throws {ValidationError} If the response format is invalid
   * @private
   */
  private async parseRecipeResponse(text: string): Promise<Partial<CreateRecipeDTO>> {
    const sections = text.split(/\n(?=[A-Z]+:)/).reduce(
      (acc, section) => {
        const [header, ...content] = section.split('\n');
        const key = header.replace(':', '').toLowerCase();
        acc[key] = content.join('\n').trim();
        return acc;
      },
      {} as Record<string, string>
    );

    if (!sections.title || !sections.ingredients || !sections.instructions) {
      throw new ValidationError('Invalid recipe format: missing required sections');
    }

    const ingredients = RecipeParserUtils.parseIngredients(sections.ingredients.split('\n'));
    const instructions = RecipeParserUtils.parseInstructions(sections.instructions.split('\n'));

    if (ingredients.length === 0 || instructions.length === 0) {
      throw new ValidationError('Invalid recipe format: empty ingredients or instructions');
    }

    return {
      title: sections.title,
      description: sections.description || '',
      ingredients,
      instructions,
    };
  }

  /**
   * Logs recipe generation attempts for analytics and monitoring.
   * @param request - Original recipe request
   * @param recipe - Generated recipe (or empty object if failed)
   * @param success - Whether generation was successful
   * @param error - Optional error message if generation failed
   * @private
   */
  private async logRecipeGeneration(
    request: AIRecipeRequest,
    recipe: Partial<CreateRecipeDTO>,
    success: boolean,
    error?: string
  ): Promise<void> {
    try {
      const log: AIRecipeLog = {
        _id: new ObjectId(),
        timestamp: new Date(),
        request,
        recipe,
        success,
        model: 'gemini-pro',
        ...(error && { error })
      };

      const result = await this.db.getCollection<AIRecipeLog>('ai_recipe_logs').insertOne(log);
      
      if (!result.acknowledged) {
        throw new MongoWriteError('Failed to log recipe generation');
      }
    } catch (error) {
      // Log the error but don't throw it to avoid interrupting the recipe generation
      logger.error('Failed to log recipe generation:', error);
    }
  }
}

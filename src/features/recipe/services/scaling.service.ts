;
;
import type { Collection } from 'mongodb';
import type { Recipe } from '../types/express.js';
import type { ObjectId } from '../types/express.js';
import { Db } from 'mongodb';;
import { connectToDatabase } from '../db.js';;
import type { RecipeDocument, RecipeIngredient, RecipeInstruction } from '../types/express.js';
import type { UnitCategory } from '../types/express.js';
import { ScalingHistory } from '../types/scaling.js';;
import type { UnitConversionService } from '../types/express.js';
import { DatabaseError, NotFoundError, ValidationError } from '../utils/errors.js';;
import logger from '../utils/logger.js';

// Unit conversion types
interface PreferredUnits {
  volume?: string;
  weight?: string;
  length?: string;
  temperature?: 'C' | 'F';
}

// Scaling result types
interface ScalingResult {
  recipe: RecipeDocument;
  scalingFactor: number;
  originalServings: number;
}

interface UnitConversionResult {
  recipe: RecipeDocument;
  conversions: {
    ingredients: Array<{
      index: number;
      from: string;
      to: string;
      success: boolean;
    }>;
    temperatures: Array<{
      instructionIndex: number;
      from: string;
      to: string;
      success: boolean;
    }>;
  };
}

export interface ScalingServiceInterface {
  scaleServings(
    recipeId: ObjectId,
    targetServings: number,
    userId: ObjectId
  ): Promise<ScalingResult>;
  getScalingHistory(recipeId: ObjectId): Promise<ScalingHistory[]>;
  getPopularScalingFactors(recipeId: ObjectId): Promise<number[]>;
  convertUnits(recipeId: ObjectId, preferredUnits: PreferredUnits): Promise<UnitConversionResult>;
}

export class ScalingService implements ScalingServiceInterface {
  private static instance: ScalingService;
  private initialized: boolean = false;
  private db!: Db;
  private recipesCollection!: Collection<RecipeDocument>;
  private historyCollection!: Collection<ScalingHistory>;
  private readonly unitConversionService: UnitConversionService;

  private constructor() {
    this.unitConversionService = UnitConversionService.getInstance();
    this.initialize().catch(error => {
      logger.error('Failed to initialize ScalingService:', error);
    });
  }

  private async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      this.db = await connectToDatabase();
      this.recipesCollection = this.db.collection<RecipeDocument>('recipes');
      this.historyCollection = this.db.collection<ScalingHistory>('scaling_history');
      this.initialized = true;
      logger.info('ScalingService initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize ScalingService:', error);
      throw new DatabaseError('Failed to initialize ScalingService');
    }
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  public static getInstance(): ScalingService {
    if (!ScalingService.instance) {
      ScalingService.instance = new ScalingService();
    }
    return ScalingService.instance;
  }

  public async scaleServings(
    recipeId: ObjectId,
    targetServings: number,
    userId: ObjectId
  ): Promise<ScalingResult> {
    await this.ensureInitialized();

    try {
      // Validate input
      if (targetServings <= 0) {
        throw new ValidationError('Target servings must be greater than 0');
      }

      // Get recipe
      const recipe = await this.recipesCollection.findOne({ _id: recipeId });
      if (!recipe) {
        throw new NotFoundError('Recipe not found');
      }

      // Calculate scaling factor
      const scalingFactor = targetServings / recipe.servings;
      const originalServings = recipe.servings;

      // Scale ingredients
      recipe.ingredients = recipe.ingredients.map((ingredient: RecipeIngredient) => ({
        ...ingredient,
        amount: this.roundToSignificantDigits(ingredient.amount * scalingFactor, 3),
      }));

      recipe.servings = targetServings;

      // Record scaling history
      await this.recordScalingHistory(recipeId, targetServings, userId, true);

      return {
        recipe,
        scalingFactor,
        originalServings,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await this.recordScalingHistory(recipeId, targetServings, userId, false, errorMessage);

      if (error instanceof ValidationError || error instanceof NotFoundError) {
        throw error;
      }
      logger.error('Failed to scale recipe:', error);
      throw new DatabaseError('Failed to scale recipe');
    }
  }

  private async recordScalingHistory(
    recipeId: ObjectId,
    targetServings: number,
    userId: ObjectId,
    success: boolean,
    error?: string
  ): Promise<void> {
    try {
      const recipe = await this.recipesCollection.findOne({ _id: recipeId });
      if (!recipe) {
        throw new NotFoundError('Recipe not found');
      }

      const history: Omit<ScalingHistory, '_id'> = {
        userId,
        recipeId,
        timestamp: new Date(),
        originalServings: recipe.servings,
        newServings: targetServings,
        scalingFactor: {
          value: targetServings / recipe.servings,
          method: 'servings',
        },
        success,
        notes: error,
      };

      await this.historyCollection.insertOne(history);
    } catch (error) {
      logger.error('Failed to record scaling history:', error);
      // Don't throw here as this is a background operation
    }
  }

  public async getScalingHistory(recipeId: ObjectId): Promise<ScalingHistory[]> {
    await this.ensureInitialized();

    try {
      return await this.historyCollection
        .find({ recipeId })
        .sort({ timestamp: -1 })
        .limit(10)
        .toArray();
    } catch (error) {
      logger.error('Failed to get scaling history:', error);
      throw new DatabaseError('Failed to get scaling history');
    }
  }

  public async getPopularScalingFactors(recipeId: ObjectId): Promise<number[]> {
    await this.ensureInitialized();

    try {
      const history = await this.historyCollection
        .find({
          recipeId,
          success: true,
          newServings: { $ne: 0 },
        })
        .sort({ timestamp: -1 })
        .limit(100)
        .toArray();

      // Get unique servings values and ensure they are numbers
      const uniqueServings = [...new Set(history.map(h => h.newServings))].filter(
        (servings): servings is number => typeof servings === 'number' && servings > 0
      );

      // Sort by frequency
      return uniqueServings
        .sort((a: any, b: any) => {
          const countA = history.filter(h => h.newServings === a).length;
          const countB = history.filter(h => h.newServings === b).length;
          return countB - countA;
        })
        .slice(0, 5);
    } catch (error) {
      logger.error('Failed to get popular scaling factors:', error);
      throw new DatabaseError('Failed to get popular scaling factors');
    }
  }

  public async convertUnits(
    recipeId: ObjectId,
    preferredUnits: PreferredUnits
  ): Promise<UnitConversionResult> {
    await this.ensureInitialized();

    try {
      // Get recipe
      const recipe = await this.recipesCollection.findOne({ _id: recipeId });
      if (!recipe) {
        throw new NotFoundError('Recipe not found');
      }

      const conversions = {
        ingredients: [] as Array<{
          index: number;
          from: string;
          to: string;
          success: boolean;
        }>,
        temperatures: [] as Array<{
          instructionIndex: number;
          from: string;
          to: string;
          success: boolean;
        }>,
      };

      // Convert ingredient units
      recipe.ingredients = recipe.ingredients.map((ingredient: any, index: any) => {
        const { unit } = ingredient;
        const unitType = this.unitConversionService.getUnitType(unit);

        if (!unitType) return ingredient;

        const preferred = preferredUnits[unitType as keyof PreferredUnits];
        if (!preferred || preferred === unit) return ingredient;

        const converted = this.unitConversionService.convert(ingredient.amount, unit, preferred);
        if (!converted) {
          conversions.ingredients.push({
            index,
            from: unit,
            to: preferred,
            success: false,
          });
          return ingredient;
        }

        conversions.ingredients.push({
          index,
          from: unit,
          to: preferred,
          success: true,
        });

        return {
          ...ingredient,
          amount: this.roundToSignificantDigits(converted, 3),
          unit: preferred,
        };
      });

      // Convert instruction temperatures
      recipe.instructions = recipe.instructions.map((instruction: any, index: any) => {
        if (!instruction.temperature?.value) return instruction;

        const preferred = preferredUnits.temperature;
        if (!preferred) return instruction;

        const converted = this.unitConversionService.convert(
          instruction.temperature.value,
          instruction.temperature.unit,
          preferred
        );

        if (!converted) {
          conversions.temperatures.push({
            instructionIndex: index,
            from: instruction.temperature.unit,
            to: preferred,
            success: false,
          });
          return instruction;
        }

        conversions.temperatures.push({
          instructionIndex: index,
          from: instruction.temperature.unit,
          to: preferred,
          success: true,
        });

        return {
          ...instruction,
          temperature: {
            value: this.roundToSignificantDigits(converted, 3),
            unit: preferred,
          },
        };
      });

      return { recipe, conversions };
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      logger.error('Failed to convert units:', error);
      throw new DatabaseError('Failed to convert units');
    }
  }

  private roundToSignificantDigits(num: number, digits: number): number {
    if (num === 0) return 0;
    const magnitude = Math.floor(Math.log10(Math.abs(num))) + 1;
    const scale = Math.pow(10, digits - magnitude);
    return Math.round(num * scale) / scale;
  }
}

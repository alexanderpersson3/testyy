import type { Recipe } from '../types/express.js';
import { ObjectId } from 'mongodb';;;;
/**
 * Scaling methods
 */
export type ScalingMethod = 'multiply' | 'divide' | 'servings' | 'custom';

/**
 * Scaling factor for recipe ingredients
 */
export interface ScalingFactor {
  value: number;
  method: ScalingMethod;
}

/**
 * Scaled ingredient with original and new values
 */
export interface ScaledIngredient {
  original: {
    amount: number;
    unit: string;
  };
  scaled: {
    amount: number;
    unit: string;
  };
  name: string;
  notes?: string;
}

/**
 * Recipe scaling result
 */
export interface ScalingResult {
  recipeId: ObjectId;
  originalServings: number;
  newServings: number;
  scalingFactor: ScalingFactor;
  ingredients: ScaledIngredient[];
  instructions: string[];
  cookingTime: {
    prep: number;
    cook: number;
    total: number;
  };
  notes: string[];
}

/**
 * Unit conversion table
 */
export interface UnitConversion {
  fromUnit: string;
  toUnit: string;
  factor: number;
  type: 'volume' | 'weight' | 'length' | 'temperature' | 'count';
}

/**
 * Ingredient scaling rules
 */
export interface IngredientScalingRule {
  ingredientType: string;
  scalingBehavior: {
    method: ScalingMethod;
    maxFactor?: number;
    minFactor?: number;
    roundingRule?: 'up' | 'down' | 'nearest';
    specialInstructions?: string[];
  };
}

/**
 * Scaling preferences
 */
export interface ScalingPreferences {
  defaultMethod: ScalingMethod;
  roundingPrecision: number;
  preferredUnits: {
    volume?: string;
    weight?: string;
    length?: string;
    temperature?: string;
  };
  convertToPreferredUnits: boolean;
  adjustCookingTime: boolean;
  scaleInstructions: boolean;
}

/**
 * Scaling history entry
 */
export interface ScalingHistory {
  _id?: ObjectId;
  userId: ObjectId;
  recipeId: ObjectId;
  timestamp: Date;
  originalServings: number;
  newServings: number;
  scalingFactor: ScalingFactor;
  success: boolean;
  notes?: string;
}

/**
 * Scaling error types
 */
export type ScalingErrorType =
  | 'invalid_factor'
  | 'unsupported_unit'
  | 'conversion_error'
  | 'ingredient_limit'
  | 'instruction_error';

/**
 * Scaling error
 */
export interface ScalingError {
  type: ScalingErrorType;
  message: string;
  details?: {
    ingredient?: string;
    unit?: string;
    value?: number;
    limit?: number;
  };
}

export interface ScalingRequest {
  recipeId: string;
  targetServings: number;
}

// Unit conversion constants and types
export type UnitCategory = 'volume' | 'weight' | 'length' | 'temperature' | 'count' | 'custom';

export interface UnitDefinition {
  name: string;
  abbreviations: string[];
  category: UnitCategory;
  baseUnit: string;
  toBase: number; // Conversion factor to base unit
  defaultPrecision: number;
  minAmount?: number; // Minimum meaningful amount
  maxAmount?: number; // Maximum meaningful amount
  stepSize?: number; // Preferred step size for rounding
  isBaseUnit?: boolean;
}

export interface ScalingOptions {
  roundToFractions?: boolean; // Round to common fractions (1/4, 1/3, 1/2, etc.)
  preferredUnits?: Record<UnitCategory, string[]>; // Preferred units per category
  maxPrecision?: number; // Maximum decimal places
  convertToPreferred?: boolean; // Convert to preferred units when possible
  scaleMethod?: 'linear' | 'proportional' | 'custom';
  roundingMethod?: 'standard' | 'up' | 'down' | 'nearest-fraction';
}

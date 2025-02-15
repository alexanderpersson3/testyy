import type { Recipe } from '../types/express.js';
import type { RecipeIngredient, RecipeInstruction } from '../types/express.js';
import logger from '../utils/logger.js';

export interface ValidationError {
  message: string;
  code: string;
  field?: string;
}

export interface ValidationWarning {
  message: string;
  code: string;
  field?: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationOptions {
  strictMode?: boolean;
  validateImages?: boolean;
  validateTimes?: boolean;
  minIngredients?: number;
  maxIngredients?: number;
  minInstructions?: number;
  maxInstructions?: number;
}

const DEFAULT_OPTIONS: ValidationOptions = {
  strictMode: false,
  validateImages: true,
  validateTimes: true,
  minIngredients: 1,
  maxIngredients: 100,
  minInstructions: 1,
  maxInstructions: 50,
};

export function validateRecipe(
  recipe: Partial<Recipe>,
  options: ValidationOptions = {}
): ValidationResult {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  validateRequiredFields(recipe, errors);
  if (recipe.ingredients) {
    validateIngredients(recipe.ingredients, opts, errors, warnings);
  }

  // Instructions
  if (recipe.instructions) {
    validateInstructions(recipe.instructions, opts, errors, warnings);
  }

  // Times
  if (opts.validateTimes) {
    validateTimes(recipe, errors, warnings);
  }

  // Images
  if (opts.validateImages && recipe.images) {
    validateImages(recipe.images, errors, warnings);
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

function validateRequiredFields(recipe: Partial<Recipe>, errors: ValidationError[]): void {
  if (!recipe.title?.trim()) {
    errors.push({
      field: 'title',
      message: 'Title is required',
      code: 'REQUIRED_FIELD',
    });
  }

  if (!recipe.description?.trim()) {
    errors.push({
      field: 'description',
      message: 'Description is required',
      code: 'REQUIRED_FIELD',
    });
  }

  if (!recipe.ingredients || recipe.ingredients.length === 0) {
    errors.push({
      field: 'ingredients',
      message: 'At least one ingredient is required',
      code: 'REQUIRED_FIELD',
    });
  }

  if (!recipe.instructions || recipe.instructions.length === 0) {
    errors.push({
      field: 'instructions',
      message: 'At least one instruction is required',
      code: 'REQUIRED_FIELD',
    });
  }
}

function validateIngredients(
  ingredients: RecipeIngredient[],
  options: ValidationOptions,
  errors: ValidationError[],
  warnings: ValidationWarning[]
): void {
  if (ingredients.length < (options.minIngredients || 1)) {
    errors.push({
      field: 'ingredients',
      message: `Recipe must have at least ${options.minIngredients} ingredient(s)`,
      code: 'MIN_INGREDIENTS',
    });
  }

  if (ingredients.length > (options.maxIngredients || 100)) {
    errors.push({
      field: 'ingredients',
      message: `Recipe cannot have more than ${options.maxIngredients} ingredients`,
      code: 'MAX_INGREDIENTS',
    });
  }

  ingredients.forEach((ingredient: any, index: any) => {
    if (!ingredient.name?.trim()) {
      errors.push({
        field: `ingredients[${index}].name`,
        message: 'Ingredient name is required',
        code: 'REQUIRED_FIELD',
      });
    }

    if (ingredient.amount <= 0) {
      errors.push({
        field: `ingredients[${index}].amount`,
        message: 'Ingredient amount must be greater than 0',
        code: 'INVALID_AMOUNT',
      });
    }

    if (!ingredient.unit?.trim()) {
      warnings.push({
        field: `ingredients[${index}].unit`,
        message: 'Ingredient unit is recommended',
        code: 'MISSING_UNIT',
      });
    }
  });
}

function validateInstructions(
  instructions: RecipeInstruction[],
  options: ValidationOptions,
  errors: ValidationError[],
  warnings: ValidationWarning[]
): void {
  if (instructions.length < (options.minInstructions || 1)) {
    errors.push({
      field: 'instructions',
      message: `Recipe must have at least ${options.minInstructions} instruction(s)`,
      code: 'MIN_INSTRUCTIONS',
    });
  }

  if (instructions.length > (options.maxInstructions || 50)) {
    errors.push({
      field: 'instructions',
      message: `Recipe cannot have more than ${options.maxInstructions} instructions`,
      code: 'MAX_INSTRUCTIONS',
    });
  }

  instructions.forEach((instruction: any, index: any) => {
    if (!instruction.text?.trim()) {
      errors.push({
        field: `instructions[${index}].text`,
        message: 'Instruction text is required',
        code: 'REQUIRED_FIELD',
      });
    }

    if (instruction.duration && instruction.duration <= 0) {
      errors.push({
        field: `instructions[${index}].duration`,
        message: 'Instruction duration must be greater than 0',
        code: 'INVALID_DURATION',
      });
    }

    if (instruction.temperature) {
      validateTemperature(instruction.temperature, index, errors);
    }
  });
}

function validateTimes(
  recipe: Partial<Recipe>,
  errors: ValidationError[],
  warnings: ValidationWarning[]
): void {
  if (recipe.prepTime !== undefined && recipe.prepTime < 0) {
    errors.push({
      field: 'prepTime',
      message: 'Preparation time cannot be negative',
      code: 'INVALID_TIME',
    });
  }

  if (recipe.cookTime !== undefined && recipe.cookTime < 0) {
    errors.push({
      field: 'cookTime',
      message: 'Cooking time cannot be negative',
      code: 'INVALID_TIME',
    });
  }

  if (recipe.totalTime !== undefined) {
    const calculatedTotal = (recipe.prepTime || 0) + (recipe.cookTime || 0);
    if (recipe.totalTime < calculatedTotal) {
      errors.push({
        field: 'totalTime',
        message: 'Total time cannot be less than prep time + cook time',
        code: 'INVALID_TOTAL_TIME',
      });
    }
  }
}

function validateImages(
  images: string[],
  errors: ValidationError[],
  warnings: ValidationWarning[]
): void {
  if (images.length === 0) {
    warnings.push({
      field: 'images',
      message: 'Recipe images are recommended',
      code: 'NO_IMAGES',
    });
  }

  images.forEach((image: any, index: any) => {
    if (!image?.trim()) {
      errors.push({
        field: `images[${index}]`,
        message: 'Image URL cannot be empty',
        code: 'INVALID_IMAGE',
      });
    }
  });
}

function validateTemperature(
  temperature: { value: number; unit: 'C' | 'F' },
  instructionIndex: number,
  errors: ValidationError[]
): void {
  if (temperature.unit === 'C') {
    if (temperature.value < 0 || temperature.value > 500) {
      errors.push({
        field: `instructions[${instructionIndex}].temperature`,
        message: 'Temperature must be between 0°C and 500°C',
        code: 'INVALID_TEMPERATURE',
      });
    }
  } else {
    if (temperature.value < 32 || temperature.value > 932) {
      errors.push({
        field: `instructions[${instructionIndex}].temperature`,
        message: 'Temperature must be between 32°F and 932°F',
        code: 'INVALID_TEMPERATURE',
      });
    }
  }
}

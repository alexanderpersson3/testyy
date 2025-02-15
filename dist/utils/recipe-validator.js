import logger from '../utils/logger.js';
const DEFAULT_OPTIONS = {
    strictMode: false,
    validateImages: true,
    validateTimes: true,
    minIngredients: 1,
    maxIngredients: 100,
    minInstructions: 1,
    maxInstructions: 50,
};
export function validateRecipe(recipe, options = {}) {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    const errors = [];
    const warnings = [];
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
function validateRequiredFields(recipe, errors) {
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
function validateIngredients(ingredients, options, errors, warnings) {
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
    ingredients.forEach((ingredient, index) => {
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
function validateInstructions(instructions, options, errors, warnings) {
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
    instructions.forEach((instruction, index) => {
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
function validateTimes(recipe, errors, warnings) {
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
function validateImages(images, errors, warnings) {
    if (images.length === 0) {
        warnings.push({
            field: 'images',
            message: 'Recipe images are recommended',
            code: 'NO_IMAGES',
        });
    }
    images.forEach((image, index) => {
        if (!image?.trim()) {
            errors.push({
                field: `images[${index}]`,
                message: 'Image URL cannot be empty',
                code: 'INVALID_IMAGE',
            });
        }
    });
}
function validateTemperature(temperature, instructionIndex, errors) {
    if (temperature.unit === 'C') {
        if (temperature.value < 0 || temperature.value > 500) {
            errors.push({
                field: `instructions[${instructionIndex}].temperature`,
                message: 'Temperature must be between 0°C and 500°C',
                code: 'INVALID_TEMPERATURE',
            });
        }
    }
    else {
        if (temperature.value < 32 || temperature.value > 932) {
            errors.push({
                field: `instructions[${instructionIndex}].temperature`,
                message: 'Temperature must be between 32°F and 932°F',
                code: 'INVALID_TEMPERATURE',
            });
        }
    }
}
//# sourceMappingURL=recipe-validator.js.map
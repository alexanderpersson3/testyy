import { ObjectId } from 'mongodb';
;
import logger from '../utils/logger.js';
export class ValidationError extends Error {
    constructor(message, code, field) {
        super(message);
        this.message = message;
        this.code = code;
        this.field = field;
        this.name = 'ValidationError';
    }
}
export async function parseRecipe(content, options = {}) {
    const warnings = [];
    try {
        // Basic structure for recipe parsing
        const recipe = {
            title: extractTitle(content),
            description: extractDescription(content),
            ingredients: extractIngredients(content),
            instructions: extractInstructions(content),
            confidence: calculateConfidence(content),
        };
        if (options.extractTimes) {
            const times = extractTimes(content);
            recipe.prepTime = times.prepTime;
            recipe.cookTime = times.cookTime;
            recipe.totalTime = times.totalTime;
            if (!times.prepTime && !times.cookTime) {
                warnings.push('Could not extract preparation or cooking times');
            }
        }
        if (options.extractTags) {
            recipe.tags = extractTags(content);
            if (!recipe.tags.length) {
                warnings.push('No tags could be extracted');
            }
        }
        // Validate confidence threshold
        if (options.minConfidence && recipe.confidence < options.minConfidence) {
            throw new ValidationError('Recipe parsing confidence below threshold', 'PARSE_FAILED', 'confidence');
        }
        return { recipe, warnings };
    }
    catch (error) {
        logger.error('Failed to parse recipe:', error);
        if (error instanceof ValidationError) {
            throw error;
        }
        throw createParseError('PARSE_FAILED', 'Recipe parsing failed', { error });
    }
}
function extractTitle(content) {
    if (!content.trim()) {
        throw createParseError('EMPTY_CONTENT', 'Content is empty');
    }
    const lines = content.split('\n');
    const title = lines[0]?.trim();
    if (!title) {
        throw createParseError('NO_TITLE', 'Could not extract title');
    }
    return title;
}
function extractDescription(content) {
    const lines = content.split('\n').filter(line => line.trim());
    return lines[1]?.trim() || '';
}
function extractIngredients(content) {
    const ingredients = [];
    const lines = content.split('\n');
    let inIngredientsSection = false;
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed)
            continue;
        if (trimmed.toLowerCase().includes('ingredients')) {
            inIngredientsSection = true;
            continue;
        }
        if (inIngredientsSection && trimmed.toLowerCase().includes('instructions')) {
            break;
        }
        if (inIngredientsSection) {
            const ingredient = parseIngredientLine(trimmed);
            if (ingredient) {
                ingredients.push(ingredient);
            }
        }
    }
    return ingredients;
}
function parseIngredientLine(line) {
    // Basic ingredient line parser
    const match = line.match(/^([\d.\/]+)?\s*(\w+)?\s+(.+)$/);
    if (!match)
        return null;
    const [, amount, unit, name] = match;
    return {
        name: name.trim(),
        amount: parseFloat(amount) || 1,
        unit: unit?.trim() || 'piece',
    };
}
function extractInstructions(content) {
    const instructions = [];
    const lines = content.split('\n');
    let inInstructionsSection = false;
    let step = 1;
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed)
            continue;
        if (trimmed.toLowerCase().includes('instructions')) {
            inInstructionsSection = true;
            continue;
        }
        if (inInstructionsSection) {
            instructions.push({
                step,
                text: trimmed,
            });
            step++;
        }
    }
    return instructions;
}
function extractTimes(content) {
    const times = {};
    // Look for time patterns
    const prepMatch = content.match(/prep(?:aration)?\s*time:?\s*(\d+)/i);
    const cookMatch = content.match(/cook(?:ing)?\s*time:?\s*(\d+)/i);
    const totalMatch = content.match(/total\s*time:?\s*(\d+)/i);
    if (prepMatch)
        times.prepTime = parseInt(prepMatch[1], 10);
    if (cookMatch)
        times.cookTime = parseInt(cookMatch[1], 10);
    if (totalMatch)
        times.totalTime = parseInt(totalMatch[1], 10);
    return times;
}
function extractTags(content) {
    const commonTags = ['vegetarian', 'vegan', 'gluten-free', 'dairy-free', 'quick', 'easy'];
    return commonTags.filter(tag => content.toLowerCase().includes(tag));
}
function calculateConfidence(content) {
    let score = 0;
    // Check for required sections
    if (content.toLowerCase().includes('ingredients'))
        score += 0.3;
    if (content.toLowerCase().includes('instructions'))
        score += 0.3;
    // Check for optional sections
    if (content.toLowerCase().includes('prep time'))
        score += 0.1;
    if (content.toLowerCase().includes('cook time'))
        score += 0.1;
    if (content.toLowerCase().includes('servings'))
        score += 0.1;
    if (content.toLowerCase().includes('description'))
        score += 0.1;
    return Math.min(1, score);
}
export function validateParsedRecipe(recipe) {
    return (typeof recipe.title === 'string' &&
        recipe.title.length > 0 &&
        typeof recipe.description === 'string' &&
        Array.isArray(recipe.ingredients) &&
        recipe.ingredients.length > 0 &&
        Array.isArray(recipe.instructions) &&
        recipe.instructions.length > 0 &&
        recipe.confidence > 0);
}
export function convertToRecipe(parsed) {
    if (!validateParsedRecipe(parsed)) {
        throw new ValidationError('Invalid parsed recipe', 'INVALID_RECIPE', 'parsed');
    }
    return {
        title: parsed.title,
        description: parsed.description || '',
        ingredients: parsed.ingredients,
        instructions: parsed.instructions,
        servings: parsed.servings || 4,
        prepTime: parsed.prepTime || 0,
        cookTime: parsed.cookTime || 0,
        totalTime: parsed.totalTime || (parsed.prepTime || 0) + (parsed.cookTime || 0),
        difficulty: parsed.difficulty || 'medium',
        cuisine: parsed.cuisine || '',
        tags: parsed.tags || [],
        images: [],
        author: {
            _id: new ObjectId(),
            name: 'System Parser',
        },
        ratings: {
            average: 0,
            count: 0,
        },
        language: 'en',
        availableLanguages: ['en']
    };
}
function createParseError(code, message, details) {
    const error = new Error(message);
    error.code = code;
    error.details = details;
    return error;
}
//# sourceMappingURL=recipe-parser.js.map
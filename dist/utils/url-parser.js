import axios from 'axios';
import { JSDOM } from 'jsdom';
import { parseIngredients } from './ingredient-parser.js';
import { parseInstructions } from './instruction-parser.js';
import logger from './logger.js';
import { ObjectId } from 'mongodb';
;
/**
 * Parse recipe from a URL
 */
export async function parseRecipeFromUrl(url) {
    try {
        // Fetch URL content
        const response = await axios.get(url);
        const html = response.data;
        // Try to parse structured data first
        const structuredData = extractStructuredData(html);
        if (structuredData) {
            return parseStructuredRecipe(structuredData);
        }
        // Fall back to HTML parsing
        return parseHtmlRecipe(html, url);
    }
    catch (error) {
        throw new Error(`Failed to parse recipe from URL: ${error.message}`);
    }
}
/**
 * Extract structured recipe data (JSON-LD)
 */
function extractStructuredData(html) {
    try {
        const dom = new JSDOM(html);
        const scripts = dom.window.document.querySelectorAll('script[type="application/ld+json"]');
        for (const script of scripts) {
            const data = JSON.parse(script.textContent || '');
            // Handle single recipe
            if (data['@type'] === 'Recipe') {
                return data;
            }
            // Handle graph structure
            if (data['@graph']) {
                const recipe = data['@graph'].find((item) => item['@type'] === 'Recipe');
                if (recipe) {
                    return recipe;
                }
            }
        }
        return null;
    }
    catch (error) {
        console.warn('Failed to extract structured data:', error);
        return null;
    }
}
/**
 * Parse recipe from structured data
 */
function parseStructuredRecipe(data) {
    const recipe = {
        title: data.name,
        description: data.description || '',
        prepTime: parseDuration(data.prepTime) || 0,
        cookTime: parseDuration(data.cookTime) || 0,
        servings: parseServings(data.recipeYield) || 0,
        ingredients: [],
        instructions: [],
        images: [],
        author: {
            _id: new ObjectId(),
            name: 'System Parser'
        },
        ratings: {
            average: 0,
            count: 0
        },
        language: 'en',
        availableLanguages: ['en']
    };
    // Parse ingredients
    if (data.recipeIngredient) {
        recipe.ingredients = parseIngredients(data.recipeIngredient);
    }
    // Parse instructions
    if (data.recipeInstructions) {
        const instructions = data.recipeInstructions.map(instruction => {
            if (typeof instruction === 'string') {
                return instruction;
            }
            return instruction.text;
        });
        recipe.instructions = parseInstructions(instructions);
    }
    // Parse image
    if (data.image) {
        if (typeof data.image === 'string') {
            recipe.images = [data.image];
        }
        else if (Array.isArray(data.image) && data.image[0]) {
            recipe.images = [data.image[0].url];
        }
    }
    return recipe;
}
/**
 * Parse recipe from HTML content
 */
async function parseHtmlRecipe(html, url) {
    const dom = new JSDOM(html);
    const doc = dom.window.document;
    // Try to find recipe content using common selectors
    const selectors = {
        title: ['h1', '.recipe-title', '.entry-title'],
        description: ['.recipe-description', '.entry-content p:first-of-type'],
        ingredients: ['.recipe-ingredients', '.ingredients-list'],
        instructions: ['.recipe-instructions', '.instructions-list'],
        prepTime: ['.prep-time', '.recipe-prep-time'],
        cookTime: ['.cook-time', '.recipe-cook-time'],
        servings: ['.recipe-yield', '.servings'],
    };
    const recipe = {
        title: findContent(doc, selectors.title) || new URL(url).hostname,
        description: findContent(doc, selectors.description) || '',
        prepTime: parseTimeString(findContent(doc, selectors.prepTime)) || 0,
        cookTime: parseTimeString(findContent(doc, selectors.cookTime)) || 0,
        servings: parseInt(findContent(doc, selectors.servings) || '0'),
        ingredients: [],
        instructions: [],
        images: [],
        author: {
            _id: new ObjectId(),
            name: 'System Parser'
        },
        ratings: {
            average: 0,
            count: 0
        },
        language: 'en',
        availableLanguages: ['en']
    };
    // Parse ingredients
    const ingredientsList = findElements(doc, selectors.ingredients);
    if (ingredientsList.length > 0) {
        const ingredientStrings = ingredientsList.map(el => el.textContent || '');
        recipe.ingredients = parseIngredients(ingredientStrings);
    }
    // Parse instructions
    const instructionsList = findElements(doc, selectors.instructions);
    if (instructionsList.length > 0) {
        const instructionStrings = instructionsList.map(el => el.textContent || '');
        recipe.instructions = parseInstructions(instructionStrings);
    }
    return recipe;
}
/**
 * Find content using multiple selectors
 */
function findContent(doc, selectors) {
    for (const selector of selectors) {
        const element = doc.querySelector(selector);
        if (element && element.textContent) {
            return element.textContent.trim();
        }
    }
    return null;
}
/**
 * Find elements using multiple selectors
 */
function findElements(doc, selectors) {
    for (const selector of selectors) {
        const elements = doc.querySelectorAll(selector);
        if (elements.length > 0) {
            return Array.from(elements);
        }
    }
    return [];
}
/**
 * Parse ISO duration string
 */
function parseDuration(duration) {
    if (!duration)
        return 0;
    const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match)
        return 0;
    const [, hours, minutes, seconds] = match;
    return (parseInt(hours || '0') * 60 +
        parseInt(minutes || '0') +
        Math.ceil(parseInt(seconds || '0') / 60));
}
/**
 * Parse servings string/number
 */
function parseServings(servings) {
    if (!servings)
        return 0;
    if (typeof servings === 'number')
        return servings;
    const match = servings.match(/\d+/);
    return match ? parseInt(match[0]) : 0;
}
/**
 * Parse time string (e.g., "1 hour 30 minutes", "45 mins")
 */
export function parseTimeString(timeStr) {
    if (!timeStr)
        return 0;
    let minutes = 0;
    // Parse hours
    const hourMatch = timeStr.match(/(\d+)\s*(?:hour|hr|h)/i);
    if (hourMatch?.[1]) {
        minutes += Number(hourMatch[1]) * 60;
    }
    // Parse minutes
    const minuteMatch = timeStr.match(/(\d+)\s*(?:minute|min|m)/i);
    if (minuteMatch?.[1]) {
        minutes += Number(minuteMatch[1]);
    }
    return minutes;
}
export async function parseRecipeUrl(url) {
    try {
        // Implementation depends on specific recipe site parsers
        logger.info(`Parsing recipe from URL: ${url}`);
        return null;
    }
    catch (error) {
        logger.error('Error parsing recipe URL:', error);
        return null;
    }
}
//# sourceMappingURL=url-parser.js.map
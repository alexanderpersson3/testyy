import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import { ObjectId } from 'mongodb';
;
import { connectToDatabase } from '../db.js';
import logger from '../utils/logger.js';
export class AIService {
    constructor() {
        const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY || '');
        this.model = genAI.getGenerativeModel({ model: 'gemini-pro' });
    }
    static getInstance() {
        if (!AIService.instance) {
            AIService.instance = new AIService();
        }
        return AIService.instance;
    }
    async generateRecipe(request) {
        try {
            // Validate input
            if (!request.ingredients || request.ingredients.length === 0) {
                throw new Error('No ingredients provided');
            }
            // Filter out empty ingredients and trim whitespace
            request.ingredients = request.ingredients.map(i => i.trim()).filter(i => i.length > 0);
            if (request.ingredients.length === 0) {
                throw new Error('No valid ingredients provided');
            }
            // Connect to database first to ensure we have a connection
            try {
                await connectToDatabase();
            }
            catch (error) {
                logger.error('Failed to connect to database:', error);
                // Continue with recipe generation even if database connection fails
            }
            const prompt = this.buildRecipePrompt(request);
            const result = await this.model.generateContent({
                contents: [
                    {
                        role: 'user',
                        parts: [
                            {
                                text: `You are a professional chef who specializes in creating recipes based on available ingredients.

${prompt}

Please provide the recipe in a structured format that I can parse programmatically. Use these exact section headers:
TITLE:
DESCRIPTION:
INGREDIENTS:
INSTRUCTIONS:

For ingredients, use the format: "amount unit ingredient_name" (e.g., "2 cups flour")
For instructions, use numbered steps (e.g., "1. Preheat the oven to 350°F")`,
                            },
                        ],
                    },
                ],
            });
            const response = await result.response;
            const recipeText = response.text();
            if (!recipeText) {
                throw new Error('Failed to generate recipe');
            }
            const recipe = await this.parseRecipeResponse(recipeText);
            // Calculate confidence and alternatives
            const confidence = this.calculateConfidence(recipe, request);
            const alternatives = this.suggestAlternatives(request);
            // Create final recipe with defaults
            const finalRecipe = {
                ...recipe,
                difficulty: request.preferences?.difficulty || 'medium',
                prepTime: request.preferences?.maxTime ? Math.floor(request.preferences.maxTime * 0.3) : 15,
                cookTime: request.preferences?.maxTime ? Math.floor(request.preferences.maxTime * 0.7) : 30,
                servings: 4,
            };
            // Log the generation for analytics, but don't block on it
            this.logRecipeGeneration(request, finalRecipe).catch(error => {
                logger.error('Failed to log recipe generation:', error);
            });
            return {
                recipe: finalRecipe,
                confidence,
                alternatives,
            };
        }
        catch (error) {
            logger.error('Failed to generate recipe:', error);
            throw error;
        }
    }
    buildRecipePrompt(request) {
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
    async parseRecipeResponse(text) {
        const sections = text.split(/\n(?=[A-Z]+:)/).reduce((acc, section) => {
            const [header, ...content] = section.split('\n');
            const key = header.replace(':', '').toLowerCase();
            acc[key] = content.join('\n').trim();
            return acc;
        }, {});
        if (!sections.title || !sections.ingredients || !sections.instructions) {
            throw new Error('Invalid recipe format: missing required sections');
        }
        const ingredients = this.parseIngredients(sections.ingredients.split('\n'));
        const instructions = this.parseInstructions(sections.instructions.split('\n'));
        if (ingredients.length === 0 || instructions.length === 0) {
            throw new Error('Invalid recipe format: empty ingredients or instructions');
        }
        return {
            title: sections.title,
            description: sections.description || '',
            ingredients,
            instructions,
        };
    }
    parseIngredients(lines) {
        return lines
            .filter(line => line.trim())
            .map(line => {
            const match = line.trim().match(/^([\d.]+)\s+(\w+)\s+(.+)$/);
            if (!match) {
                // For ingredients without amounts, try to extract just the name
                // and provide default values
                const cleanedLine = line.trim().replace(/^[^a-zA-Z]+/, '');
                return {
                    name: cleanedLine,
                    amount: 1,
                    unit: 'piece',
                };
            }
            const [, amount, unit, name] = match;
            return {
                name: name.trim(),
                amount: parseFloat(amount),
                unit: unit.toLowerCase(),
            };
        });
    }
    parseInstructions(lines) {
        return lines
            .filter(line => line.trim())
            .map((line, index) => {
            const text = line.replace(/^\d+\.\s*/, '').trim();
            const instruction = {
                step: index + 1,
                text,
            };
            // Try to extract duration from text
            const durationMatch = text.match(/(\d+)\s*(?:minute|min|minutes?|mins?)/i);
            if (durationMatch) {
                instruction.duration = parseInt(durationMatch[1], 10);
            }
            // Try to extract temperature from text
            const tempMatch = text.match(/(\d+)(?:°|\s*degrees?\s*|\s*deg\s*)([CF])/i);
            if (tempMatch) {
                instruction.temperature = {
                    value: parseInt(tempMatch[1], 10),
                    unit: tempMatch[2].toUpperCase(),
                };
            }
            return instruction;
        });
    }
    calculateConfidence(recipe, request) {
        let confidence = 1.0;
        // Reduce confidence if we couldn't use all ingredients
        const usedIngredients = new Set(recipe.ingredients?.map(i => i.name.toLowerCase()));
        const requestedIngredients = new Set(request.ingredients.map(i => i.toLowerCase()));
        const unusedCount = Array.from(requestedIngredients).filter(i => !usedIngredients.has(i)).length;
        confidence *= 1 - (unusedCount / requestedIngredients.size) * 0.5;
        // Reduce confidence if recipe is too simple
        if (recipe.instructions && recipe.instructions.length < 3) {
            confidence *= 0.8;
        }
        // Reduce confidence if instructions are too vague
        const avgInstructionLength = recipe.instructions?.reduce((sum, i) => sum + i.text.length, 0) || 0;
        if (avgInstructionLength > 0 &&
            avgInstructionLength / (recipe.instructions?.length || 1) < 20) {
            confidence *= 0.9;
        }
        // Reduce confidence if no durations or temperatures are found
        const hasTemperature = recipe.instructions?.some(i => i.temperature);
        const hasDuration = recipe.instructions?.some(i => i.duration);
        if (!hasTemperature && !hasDuration) {
            confidence *= 0.9;
        }
        // Reduce confidence if preferences are not met
        if (request.preferences) {
            if (request.preferences.cuisine &&
                !recipe.title?.toLowerCase().includes(request.preferences.cuisine.toLowerCase())) {
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
    suggestAlternatives(request) {
        const suggestions = [];
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
    async logRecipeGeneration(request, recipe) {
        try {
            const collection = getCollection('ai_recipe_logs');
            await collection.insertOne({
                _id: new ObjectId(),
                timestamp: new Date(),
                request,
                recipe,
                success: true,
                model: 'gemini-pro',
            });
        }
        catch (error) {
            // Log the error but don't throw it to avoid interrupting the recipe generation
            logger.error('Failed to log recipe generation:', error);
        }
    }
}
//# sourceMappingURL=ai.service.js.map
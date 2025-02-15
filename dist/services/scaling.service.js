import { Db } from 'mongodb';
import { connectToDatabase } from '../db.js';
import { ScalingHistory } from '../types/scaling.js';
import { DatabaseError, NotFoundError, ValidationError } from '../utils/errors.js';
import logger from '../utils/logger.js';
export class ScalingService {
    constructor() {
        this.initialized = false;
        this.unitConversionService = UnitConversionService.getInstance();
        this.initialize().catch(error => {
            logger.error('Failed to initialize ScalingService:', error);
        });
    }
    async initialize() {
        if (this.initialized)
            return;
        try {
            this.db = await connectToDatabase();
            this.recipesCollection = this.db.collection('recipes');
            this.historyCollection = this.db.collection('scaling_history');
            this.initialized = true;
            logger.info('ScalingService initialized successfully');
        }
        catch (error) {
            logger.error('Failed to initialize ScalingService:', error);
            throw new DatabaseError('Failed to initialize ScalingService');
        }
    }
    async ensureInitialized() {
        if (!this.initialized) {
            await this.initialize();
        }
    }
    static getInstance() {
        if (!ScalingService.instance) {
            ScalingService.instance = new ScalingService();
        }
        return ScalingService.instance;
    }
    async scaleServings(recipeId, targetServings, userId) {
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
            recipe.ingredients = recipe.ingredients.map((ingredient) => ({
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
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            await this.recordScalingHistory(recipeId, targetServings, userId, false, errorMessage);
            if (error instanceof ValidationError || error instanceof NotFoundError) {
                throw error;
            }
            logger.error('Failed to scale recipe:', error);
            throw new DatabaseError('Failed to scale recipe');
        }
    }
    async recordScalingHistory(recipeId, targetServings, userId, success, error) {
        try {
            const recipe = await this.recipesCollection.findOne({ _id: recipeId });
            if (!recipe) {
                throw new NotFoundError('Recipe not found');
            }
            const history = {
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
        }
        catch (error) {
            logger.error('Failed to record scaling history:', error);
            // Don't throw here as this is a background operation
        }
    }
    async getScalingHistory(recipeId) {
        await this.ensureInitialized();
        try {
            return await this.historyCollection
                .find({ recipeId })
                .sort({ timestamp: -1 })
                .limit(10)
                .toArray();
        }
        catch (error) {
            logger.error('Failed to get scaling history:', error);
            throw new DatabaseError('Failed to get scaling history');
        }
    }
    async getPopularScalingFactors(recipeId) {
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
            const uniqueServings = [...new Set(history.map(h => h.newServings))].filter((servings) => typeof servings === 'number' && servings > 0);
            // Sort by frequency
            return uniqueServings
                .sort((a, b) => {
                const countA = history.filter(h => h.newServings === a).length;
                const countB = history.filter(h => h.newServings === b).length;
                return countB - countA;
            })
                .slice(0, 5);
        }
        catch (error) {
            logger.error('Failed to get popular scaling factors:', error);
            throw new DatabaseError('Failed to get popular scaling factors');
        }
    }
    async convertUnits(recipeId, preferredUnits) {
        await this.ensureInitialized();
        try {
            // Get recipe
            const recipe = await this.recipesCollection.findOne({ _id: recipeId });
            if (!recipe) {
                throw new NotFoundError('Recipe not found');
            }
            const conversions = {
                ingredients: [],
                temperatures: [],
            };
            // Convert ingredient units
            recipe.ingredients = recipe.ingredients.map((ingredient, index) => {
                const { unit } = ingredient;
                const unitType = this.unitConversionService.getUnitType(unit);
                if (!unitType)
                    return ingredient;
                const preferred = preferredUnits[unitType];
                if (!preferred || preferred === unit)
                    return ingredient;
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
            recipe.instructions = recipe.instructions.map((instruction, index) => {
                if (!instruction.temperature?.value)
                    return instruction;
                const preferred = preferredUnits.temperature;
                if (!preferred)
                    return instruction;
                const converted = this.unitConversionService.convert(instruction.temperature.value, instruction.temperature.unit, preferred);
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
        }
        catch (error) {
            if (error instanceof NotFoundError)
                throw error;
            logger.error('Failed to convert units:', error);
            throw new DatabaseError('Failed to convert units');
        }
    }
    roundToSignificantDigits(num, digits) {
        if (num === 0)
            return 0;
        const magnitude = Math.floor(Math.log10(Math.abs(num))) + 1;
        const scale = Math.pow(10, digits - magnitude);
        return Math.round(num * scale) / scale;
    }
}
//# sourceMappingURL=scaling.service.js.map
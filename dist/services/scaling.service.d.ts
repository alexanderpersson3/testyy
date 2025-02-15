import type { ObjectId } from '../types/index.js';
import type { RecipeDocument } from '../types/index.js';
import { ScalingHistory } from '../types/scaling.js';
interface PreferredUnits {
    volume?: string;
    weight?: string;
    length?: string;
    temperature?: 'C' | 'F';
}
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
    scaleServings(recipeId: ObjectId, targetServings: number, userId: ObjectId): Promise<ScalingResult>;
    getScalingHistory(recipeId: ObjectId): Promise<ScalingHistory[]>;
    getPopularScalingFactors(recipeId: ObjectId): Promise<number[]>;
    convertUnits(recipeId: ObjectId, preferredUnits: PreferredUnits): Promise<UnitConversionResult>;
}
export declare class ScalingService implements ScalingServiceInterface {
    private static instance;
    private initialized;
    private db;
    private recipesCollection;
    private historyCollection;
    private readonly unitConversionService;
    private constructor();
    private initialize;
    private ensureInitialized;
    static getInstance(): ScalingService;
    scaleServings(recipeId: ObjectId, targetServings: number, userId: ObjectId): Promise<ScalingResult>;
    private recordScalingHistory;
    getScalingHistory(recipeId: ObjectId): Promise<ScalingHistory[]>;
    getPopularScalingFactors(recipeId: ObjectId): Promise<number[]>;
    convertUnits(recipeId: ObjectId, preferredUnits: PreferredUnits): Promise<UnitConversionResult>;
    private roundToSignificantDigits;
}
export {};

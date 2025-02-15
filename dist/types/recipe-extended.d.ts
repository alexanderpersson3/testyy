import type { Recipe } from '../types/index.js';
import type { BaseRecipe } from '../types/index.js';
import { TimerUnit, TimerAlertType } from '../timer.js';
export interface ExtendedRecipe extends BaseRecipe {
    name: string;
    notes?: string;
}
export interface RecipeTimer {
    duration: number;
    unit: TimerUnit;
    alerts?: Array<{
        type: TimerAlertType;
        time: number;
        message: string;
    }>;
    label: string;
    description?: string;
}
export interface RecipeWithName extends Recipe {
    name: string;
    notes?: string;
}

import type { Recipe } from '../types/express.js';
import type { BaseRecipe } from '../types/express.js';
import { TimerUnit, TimerAlertType } from '../timer.js';;

// Extended recipe interface with required name field
export interface ExtendedRecipe extends BaseRecipe {
  name: string;
  notes?: string;
}

// Recipe timer configuration interface
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

// Recipe with required name field
export interface RecipeWithName extends Recipe {
  name: string;
  notes?: string;
}

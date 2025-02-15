interface ParsedIngredient {
    amount: number;
    unit: string;
    name: string;
    notes?: string;
}
/**
 * Parse ingredients from various formats
 */
export declare function parseIngredients(ingredients: string[]): ParsedIngredient[];
export {};

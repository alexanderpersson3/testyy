const COMMON_UNITS = [
    // Volume
    'cup',
    'cups',
    'c',
    'tablespoon',
    'tablespoons',
    'tbsp',
    'tbs',
    'T',
    'teaspoon',
    'teaspoons',
    'tsp',
    't',
    'fluid ounce',
    'fluid ounces',
    'fl oz',
    'milliliter',
    'milliliters',
    'ml',
    'liter',
    'liters',
    'l',
    'gallon',
    'gallons',
    'gal',
    'quart',
    'quarts',
    'qt',
    'pint',
    'pints',
    'pt',
    // Weight
    'pound',
    'pounds',
    'lb',
    'lbs',
    'ounce',
    'ounces',
    'oz',
    'gram',
    'grams',
    'g',
    'kilogram',
    'kilograms',
    'kg',
    // Count
    'piece',
    'pieces',
    'slice',
    'slices',
    'whole',
    'can',
    'cans',
    'package',
    'packages',
    'pkg',
    'bunch',
    'bunches',
    'pinch',
    'pinches',
    'dash',
    'dashes',
];
const UNIT_STANDARDIZATION = {
    // Volume
    c: 'cup',
    cups: 'cup',
    tablespoon: 'tbsp',
    tablespoons: 'tbsp',
    tbs: 'tbsp',
    T: 'tbsp',
    teaspoon: 'tsp',
    teaspoons: 'tsp',
    t: 'tsp',
    'fluid ounce': 'fl oz',
    'fluid ounces': 'fl oz',
    milliliters: 'ml',
    milliliter: 'ml',
    liters: 'l',
    liter: 'l',
    gallons: 'gal',
    gallon: 'gal',
    quarts: 'qt',
    quart: 'qt',
    pints: 'pt',
    pint: 'pt',
    // Weight
    pounds: 'lb',
    pound: 'lb',
    lbs: 'lb',
    ounces: 'oz',
    ounce: 'oz',
    grams: 'g',
    gram: 'g',
    kilograms: 'kg',
    kilogram: 'kg',
    // Count
    pieces: 'piece',
    slices: 'slice',
    cans: 'can',
    packages: 'package',
    pkg: 'package',
    bunches: 'bunch',
    pinches: 'pinch',
    dashes: 'dash',
};
/**
 * Parse ingredients from various formats
 */
export function parseIngredients(ingredients) {
    return ingredients
        .map(ingredient => parseIngredient(ingredient))
        .filter((ing) => ing !== null);
}
/**
 * Parse a single ingredient string
 */
function parseIngredient(ingredient) {
    try {
        // Clean up the input
        const cleaned = ingredient.trim().toLowerCase().replace(/\s+/g, ' ').replace(/[,.]$/, '');
        if (!cleaned)
            return null;
        // Try different parsing strategies
        const parsed = parseStructuredIngredient(cleaned) || parseUnstructuredIngredient(cleaned);
        if (!parsed)
            return null;
        return {
            amount: parseAmount(parsed.amount),
            unit: standardizeUnit(parsed.unit),
            name: cleanIngredientName(parsed.name),
            notes: parsed.notes ? parsed.notes.trim() : undefined,
        };
    }
    catch (error) {
        console.warn('Failed to parse ingredient:', ingredient, error);
        return null;
    }
}
/**
 * Parse structured ingredient (e.g., "1 cup flour")
 */
function parseStructuredIngredient(ingredient) {
    // Match pattern: amount unit ingredient (notes)
    const match = ingredient.match(/^([\d\s\/.-]+)\s*([a-zA-Z\s]+?)\s+([^(]+)(?:\s*\((.*)\))?$/);
    if (!match)
        return null;
    const [, amount, unit, name, notes] = match;
    const cleanUnit = unit.trim();
    // Verify the unit is valid
    if (!COMMON_UNITS.includes(cleanUnit)) {
        return null;
    }
    return {
        amount: amount.trim(),
        unit: cleanUnit,
        name: name.trim(),
        notes,
    };
}
/**
 * Parse unstructured ingredient (e.g., "salt and pepper to taste")
 */
function parseUnstructuredIngredient(ingredient) {
    // Handle special cases
    if (ingredient.includes('to taste')) {
        return {
            amount: '0',
            unit: 'to taste',
            name: ingredient.replace('to taste', '').trim(),
        };
    }
    // Try to find any numbers at the start
    const match = ingredient.match(/^([\d\s\/.-]+)\s*(.+)$/);
    if (match) {
        const [, amount, rest] = match;
        return {
            amount: amount.trim(),
            unit: 'piece',
            name: rest.trim(),
        };
    }
    // If no amount found, treat as "1 piece"
    return {
        amount: '1',
        unit: 'piece',
        name: ingredient,
    };
}
/**
 * Parse amount string to number
 */
function parseAmount(amount) {
    // Handle fractions
    if (amount.includes('/')) {
        const [num, denom] = amount.split('/').map(n => parseFloat(n.trim()));
        return num / denom;
    }
    // Handle ranges (use the average)
    if (amount.includes('-')) {
        const [min, max] = amount.split('-').map(n => parseFloat(n.trim()));
        return (min + max) / 2;
    }
    return parseFloat(amount);
}
/**
 * Standardize unit name
 */
function standardizeUnit(unit) {
    return UNIT_STANDARDIZATION[unit] || unit;
}
/**
 * Clean ingredient name
 */
function cleanIngredientName(name) {
    return name
        .replace(/^\W+|\W+$/g, '') // Remove leading/trailing non-word chars
        .replace(/\s+/g, ' ') // Normalize whitespace
        .toLowerCase() // Convert to lowercase
        .trim(); // Final trim
}
//# sourceMappingURL=ingredient-parser.js.map
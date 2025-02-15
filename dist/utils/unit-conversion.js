// Base units for each category
const BASE_UNITS = {
    volume: 'ml',
    weight: 'g',
    length: 'mm',
    temperature: 'celsius',
    count: 'unit',
    custom: 'custom',
};
// Common unit definitions
export const UNIT_DEFINITIONS = [
    // Volume units
    {
        name: 'milliliter',
        abbreviations: ['ml', 'mL'],
        category: 'volume',
        baseUnit: 'ml',
        toBase: 1,
        defaultPrecision: 1,
        isBaseUnit: true,
    },
    {
        name: 'liter',
        abbreviations: ['l', 'L'],
        category: 'volume',
        baseUnit: 'ml',
        toBase: 1000,
        defaultPrecision: 2,
    },
    {
        name: 'teaspoon',
        abbreviations: ['tsp', 't'],
        category: 'volume',
        baseUnit: 'ml',
        toBase: 4.92892,
        defaultPrecision: 1,
    },
    {
        name: 'tablespoon',
        abbreviations: ['tbsp', 'T'],
        category: 'volume',
        baseUnit: 'ml',
        toBase: 14.7868,
        defaultPrecision: 1,
    },
    {
        name: 'cup',
        abbreviations: ['c'],
        category: 'volume',
        baseUnit: 'ml',
        toBase: 236.588,
        defaultPrecision: 2,
    },
    // Weight units
    {
        name: 'gram',
        abbreviations: ['g'],
        category: 'weight',
        baseUnit: 'g',
        toBase: 1,
        defaultPrecision: 1,
        isBaseUnit: true,
    },
    {
        name: 'kilogram',
        abbreviations: ['kg'],
        category: 'weight',
        baseUnit: 'g',
        toBase: 1000,
        defaultPrecision: 2,
    },
    {
        name: 'ounce',
        abbreviations: ['oz'],
        category: 'weight',
        baseUnit: 'g',
        toBase: 28.3495,
        defaultPrecision: 1,
    },
    {
        name: 'pound',
        abbreviations: ['lb', 'lbs'],
        category: 'weight',
        baseUnit: 'g',
        toBase: 453.592,
        defaultPrecision: 2,
    },
    // Count units
    {
        name: 'unit',
        abbreviations: ['unit', 'piece', 'pc'],
        category: 'count',
        baseUnit: 'unit',
        toBase: 1,
        defaultPrecision: 0,
        isBaseUnit: true,
    },
    {
        name: 'dozen',
        abbreviations: ['doz'],
        category: 'count',
        baseUnit: 'unit',
        toBase: 12,
        defaultPrecision: 1,
    },
];
// Common fractions for rounding
const COMMON_FRACTIONS = [
    { decimal: 0.25, fraction: '1/4' },
    { decimal: 0.33, fraction: '1/3' },
    { decimal: 0.5, fraction: '1/2' },
    { decimal: 0.66, fraction: '2/3' },
    { decimal: 0.75, fraction: '3/4' },
];
export class UnitConverter {
    constructor() {
        this.unitDefinitions = new Map();
        this.conversions = new Map();
        this.initializeUnits();
    }
    initializeUnits() {
        // Initialize unit definitions
        for (const def of UNIT_DEFINITIONS) {
            this.unitDefinitions.set(def.name.toLowerCase(), def);
            for (const abbr of def.abbreviations) {
                this.unitDefinitions.set(abbr.toLowerCase(), def);
            }
        }
        // Initialize conversions
        for (const def of UNIT_DEFINITIONS) {
            if (!def.isBaseUnit) {
                const baseUnit = this.getBaseUnit(def.category);
                this.addConversion(def.name, baseUnit, def.toBase, def.category);
                this.addConversion(baseUnit, def.name, 1 / def.toBase, def.category);
            }
        }
    }
    addConversion(from, to, factor, category) {
        const key = `${from.toLowerCase()}-${to.toLowerCase()}`;
        if (!this.conversions.has(key)) {
            this.conversions.set(key, []);
        }
        this.conversions.get(key).push({ fromUnit: from, toUnit: to, factor, category });
    }
    getBaseUnit(category) {
        return BASE_UNITS[category];
    }
    /**
     * Convert a value from one unit to another
     */
    convert(value, fromUnit, toUnit) {
        fromUnit = fromUnit.toLowerCase();
        toUnit = toUnit.toLowerCase();
        // If units are the same, return original value
        if (fromUnit === toUnit) {
            return value;
        }
        const fromDef = this.unitDefinitions.get(fromUnit);
        const toDef = this.unitDefinitions.get(toUnit);
        if (!fromDef || !toDef) {
            return null;
        }
        // If units are in different categories, conversion is not possible
        if (fromDef.category !== toDef.category) {
            return null;
        }
        // Convert to base unit first, then to target unit
        const valueInBase = value * fromDef.toBase;
        return valueInBase / toDef.toBase;
    }
    /**
     * Round a number to a specific precision or to common fractions
     */
    round(value, options = {}) {
        const { precision = 2, useCommonFractions = false, method = 'standard' } = options;
        if (useCommonFractions) {
            // Find the closest common fraction
            const fraction = COMMON_FRACTIONS.reduce((prev, curr) => {
                return Math.abs(curr.decimal - value) < Math.abs(prev.decimal - value) ? curr : prev;
            });
            return Number(fraction.decimal.toFixed(precision));
        }
        switch (method) {
            case 'up':
                return Math.ceil(value * Math.pow(10, precision)) / Math.pow(10, precision);
            case 'down':
                return Math.floor(value * Math.pow(10, precision)) / Math.pow(10, precision);
            default:
                return Number(value.toFixed(precision));
        }
    }
    /**
     * Get the appropriate unit for a scaled value
     */
    getSuitableUnit(value, currentUnit) {
        const unitDef = this.unitDefinitions.get(currentUnit.toLowerCase());
        if (!unitDef) {
            return null;
        }
        // Get all units in the same category
        const categoryUnits = Array.from(this.unitDefinitions.values())
            .filter(def => def.category === unitDef.category)
            .sort((a, b) => a.toBase - b.toBase);
        // Find the most appropriate unit
        for (const unit of categoryUnits) {
            const converted = this.convert(value, currentUnit, unit.name);
            if (converted !== null &&
                (!unit.minAmount || converted >= unit.minAmount) &&
                (!unit.maxAmount || converted <= unit.maxAmount)) {
                return unit.abbreviations[0];
            }
        }
        return currentUnit;
    }
    /**
     * Format a value with its unit
     */
    format(value, unit, options = {}) {
        const { precision = 2, useCommonFractions = false, showUnit = true } = options;
        const roundedValue = this.round(value, { precision, useCommonFractions });
        return showUnit ? `${roundedValue} ${unit}` : roundedValue.toString();
    }
}
//# sourceMappingURL=unit-conversion.js.map
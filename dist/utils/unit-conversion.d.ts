import type { UnitDefinition } from '../types/index.js';
export declare const UNIT_DEFINITIONS: UnitDefinition[];
export declare class UnitConverter {
    private unitDefinitions;
    private conversions;
    constructor();
    private initializeUnits;
    private addConversion;
    private getBaseUnit;
    /**
     * Convert a value from one unit to another
     */
    convert(value: number, fromUnit: string, toUnit: string): number | null;
    /**
     * Round a number to a specific precision or to common fractions
     */
    round(value: number, options?: {
        precision?: number;
        useCommonFractions?: boolean;
        method?: 'standard' | 'up' | 'down' | 'nearest-fraction';
    }): number;
    /**
     * Get the appropriate unit for a scaled value
     */
    getSuitableUnit(value: number, currentUnit: string): string | null;
    /**
     * Format a value with its unit
     */
    format(value: number, unit: string, options?: {
        precision?: number;
        useCommonFractions?: boolean;
        showUnit?: boolean;
    }): string;
}

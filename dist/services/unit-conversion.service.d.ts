export declare class UnitConversionService {
    private static instance;
    private units;
    private constructor();
    static getInstance(): UnitConversionService;
    getUnitType(unit: string): UnitCategory | undefined;
    convert(amount: number, fromUnit: string, toUnit: string): number | null;
    private initializeUnits;
}

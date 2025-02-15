
export class UnitConversionService {
  private static instance: UnitConversionService;
  private units: Map<string, UnitDefinition>;

  private constructor() {
    this.units = this.initializeUnits();
  }

  public static getInstance(): UnitConversionService {
    if (!UnitConversionService.instance) {
      UnitConversionService.instance = new UnitConversionService();
    }
    return UnitConversionService.instance;
  }

  getUnitType(unit: string): UnitCategory | undefined {
    const definition = this.units.get(unit.toLowerCase());
    return definition?.category;
  }

  convert(amount: number, fromUnit: string, toUnit: string): number | null {
    const from = this.units.get(fromUnit.toLowerCase());
    const to = this.units.get(toUnit.toLowerCase());

    if (!from || !to || from.category !== to.category) {
      return null;
    }

    // Convert to base unit first
    const baseAmount = amount * from.toBase;
    // Then convert to target unit
    return baseAmount / to.toBase;
  }

  private initializeUnits(): Map<string, UnitDefinition> {
    const units = new Map<string, UnitDefinition>();

    // Volume units
    units.set('ml', {
      name: 'milliliter',
      abbreviations: ['ml', 'mL'],
      category: 'volume',
      baseUnit: 'ml',
      toBase: 1,
      defaultPrecision: 1,
      isBaseUnit: true,
    });

    units.set('l', {
      name: 'liter',
      abbreviations: ['l', 'L'],
      category: 'volume',
      baseUnit: 'ml',
      toBase: 1000,
      defaultPrecision: 2,
    });

    // Weight units
    units.set('g', {
      name: 'gram',
      abbreviations: ['g'],
      category: 'weight',
      baseUnit: 'g',
      toBase: 1,
      defaultPrecision: 1,
      isBaseUnit: true,
    });

    units.set('kg', {
      name: 'kilogram',
      abbreviations: ['kg'],
      category: 'weight',
      baseUnit: 'g',
      toBase: 1000,
      defaultPrecision: 2,
    });

    // Temperature units
    units.set('c', {
      name: 'Celsius',
      abbreviations: ['C', '°C'],
      category: 'temperature',
      baseUnit: 'c',
      toBase: 1,
      defaultPrecision: 1,
      isBaseUnit: true,
    });

    units.set('f', {
      name: 'Fahrenheit',
      abbreviations: ['F', '°F'],
      category: 'temperature',
      baseUnit: 'c',
      toBase: 0.555556, // (F-32) * 5/9
      defaultPrecision: 1,
    });

    return units;
  }
}

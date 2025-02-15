export interface UnitConversion {
  fromUnit: string;
  toUnit: string;
  factor: number;
  category?: string;
}

export interface UnitDefinition {
  name: string;
  abbreviations: string[];
  type: 'mass' | 'volume' | 'length' | 'temperature' | 'count';
  baseUnit: string;
  conversionFactor: number;
}

export interface UnitCategory {
  name: string;
  units: UnitDefinition[];
  baseUnit: string;
} 
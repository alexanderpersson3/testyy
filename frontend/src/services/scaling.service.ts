import { ObjectId } from 'mongodb';
import { Recipe } from './recipe.service';

export interface ScalingResult {
  recipeId: ObjectId;
  originalServings: number;
  newServings: number;
  scalingFactor: number;
  ingredients: Array<{
    name: string;
    originalAmount: number;
    scaledAmount: number;
    unit: string;
    notes?: string;
  }>;
  instructions: string[];
  cookingTime: {
    prep: number;
    cook: number;
    total: number;
  };
  notes: string[];
}

export interface ScalingHistory {
  recipeId: ObjectId;
  userId: ObjectId;
  originalServings: number;
  scaledServings: number;
  timestamp: Date;
}

export interface PreferredUnits {
  weight?: 'g' | 'kg' | 'oz' | 'lb';
  volume?: 'ml' | 'l' | 'cup' | 'tbsp' | 'tsp';
  temperature?: 'C' | 'F';
}

export interface UnitConversionResult {
  ingredients: Array<{
    name: string;
    amount: number;
    unit: string;
    originalUnit: string;
  }>;
  instructions: string[];
}

export interface UnitGroup {
  name: string;
  units: string[];
  baseUnit: string;
  conversionFactors: Record<string, number>;
}

export interface UnitSystem {
  name: 'metric' | 'imperial';
  defaultUnits: Record<string, string>;
}

class ScalingService {
  private static instance: ScalingService;
  private baseUrl: string;

  private constructor() {
    this.baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
  }

  public static getInstance(): ScalingService {
    if (!ScalingService.instance) {
      ScalingService.instance = new ScalingService();
    }
    return ScalingService.instance;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = localStorage.getItem('token');
    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    };

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'An error occurred');
    }

    return response.json();
  }

  async scaleServings(
    recipeId: string,
    targetServings: number
  ): Promise<ScalingResult> {
    return this.request<ScalingResult>(`/recipes/${recipeId}/scale`, {
      method: 'POST',
      body: JSON.stringify({ targetServings }),
    });
  }

  async getScalingHistory(recipeId: string): Promise<ScalingHistory[]> {
    return this.request<ScalingHistory[]>(`/recipes/${recipeId}/scaling-history`);
  }

  async getPopularScalingFactors(recipeId: string): Promise<number[]> {
    return this.request<number[]>(`/recipes/${recipeId}/popular-scaling-factors`);
  }

  async convertUnits(
    recipeId: string,
    preferredUnits: PreferredUnits
  ): Promise<UnitConversionResult> {
    return this.request<UnitConversionResult>(`/recipes/${recipeId}/convert-units`, {
      method: 'POST',
      body: JSON.stringify({ preferredUnits }),
    });
  }

  async getUnitGroups(): Promise<UnitGroup[]> {
    return this.request<UnitGroup[]>('/scaling/unit-groups');
  }

  async getUnitSystems(): Promise<UnitSystem[]> {
    return this.request<UnitSystem[]>('/scaling/unit-systems');
  }

  async convertUnit(
    value: number,
    fromUnit: string,
    toUnit: string,
    ingredient?: string
  ): Promise<UnitConversionResult> {
    return this.request<UnitConversionResult>('/scaling/convert-unit', {
      method: 'POST',
      body: JSON.stringify({
        value,
        fromUnit,
        toUnit,
        ingredient,
      }),
    });
  }

  async convertRecipeUnits(
    recipeId: string,
    targetSystem: UnitSystem['name'],
    options?: {
      preferredUnits?: Record<string, string>;
      roundToFractions?: boolean;
    }
  ): Promise<Recipe> {
    return this.request<Recipe>(`/scaling/convert-recipe/${recipeId}`, {
      method: 'POST',
      body: JSON.stringify({
        targetSystem,
        ...options,
      }),
    });
  }

  async getIngredientDensities(): Promise<Record<string, number>> {
    return this.request<Record<string, number>>('/scaling/ingredient-densities');
  }

  async updatePreferredUnits(
    preferredUnits: PreferredUnits
  ): Promise<void> {
    return this.request('/scaling/preferred-units', {
      method: 'PUT',
      body: JSON.stringify(preferredUnits),
    });
  }

  async getCommonScalingFactors(): Promise<number[]> {
    return this.request<number[]>('/scaling/common-factors');
  }

  async roundToFraction(
    value: number,
    maxDenominator: number = 16
  ): Promise<{ fraction: string; decimal: number }> {
    return this.request<{ fraction: string; decimal: number }>('/scaling/round-fraction', {
      method: 'POST',
      body: JSON.stringify({
        value,
        maxDenominator,
      }),
    });
  }

  async validateScaling(
    recipeId: string,
    scalingFactor: number
  ): Promise<{ isValid: boolean; warnings: string[] }> {
    return this.request<{ isValid: boolean; warnings: string[] }>(
      `/scaling/validate/${recipeId}`,
      {
        method: 'POST',
        body: JSON.stringify({ scalingFactor }),
      }
    );
  }
}

export const scalingService = ScalingService.getInstance(); 
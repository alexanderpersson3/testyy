import { Recipe } from './recipe.service';

export interface ScoredRecipe {
  recipe: Recipe;
  matchScore: number;
  matchFactors: {
    preferences: number;
    history: number;
    popularity: number;
    seasonality: number;
    difficulty: number;
    timing: number;
  };
}

export interface RecommendationOptions {
  limit?: number;
  excludeIds?: string[];
  includeTags?: string[];
  excludeTags?: string[];
  difficulty?: 'easy' | 'medium' | 'hard';
  maxPrepTime?: number;
  cuisine?: string;
  mealType?: string;
}

export interface RecommendationContext {
  type: 'quick' | 'meal-plan' | 'seasonal' | 'popular';
  filters?: {
    cuisine?: string[];
    difficulty?: string[];
    maxTime?: number;
    ingredients?: string[];
    dietary?: string[];
    season?: string;
  };
  preferences?: {
    cuisinePreferences: string[];
    favoriteIngredients: string[];
    dislikedIngredients: string[];
    dietaryRestrictions: string[];
  };
}

class RecommendationService {
  private static instance: RecommendationService;
  private baseUrl: string;

  private constructor() {
    this.baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
  }

  public static getInstance(): RecommendationService {
    if (!RecommendationService.instance) {
      RecommendationService.instance = new RecommendationService();
    }
    return RecommendationService.instance;
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

  async getPersonalizedRecommendations(
    options: RecommendationOptions = {}
  ): Promise<ScoredRecipe[]> {
    const params = new URLSearchParams();
    Object.entries(options).forEach(([key, value]) => {
      if (value !== undefined) {
        if (Array.isArray(value)) {
          value.forEach(v => params.append(key, v));
        } else {
          params.append(key, value.toString());
        }
      }
    });

    return this.request<ScoredRecipe[]>(`/recommendations?${params.toString()}`);
  }

  async getSimilarRecipes(
    recipeId: string,
    limit: number = 5
  ): Promise<ScoredRecipe[]> {
    return this.request<ScoredRecipe[]>(
      `/recommendations/similar/${recipeId}?limit=${limit}`
    );
  }

  async getPopularRecipes(
    options: { timeframe?: 'day' | 'week' | 'month' | 'all'; limit?: number } = {}
  ): Promise<Recipe[]> {
    const params = new URLSearchParams();
    Object.entries(options).forEach(([key, value]) => {
      if (value !== undefined) {
        params.append(key, value.toString());
      }
    });

    return this.request<Recipe[]>(`/recommendations/popular?${params.toString()}`);
  }

  async getTrendingRecipes(limit: number = 10): Promise<Recipe[]> {
    return this.request<Recipe[]>(`/recommendations/trending?limit=${limit}`);
  }

  async getSeasonalRecipes(limit: number = 10): Promise<Recipe[]> {
    return this.request<Recipe[]>(`/recommendations/seasonal?limit=${limit}`);
  }

  async getRecommendedForMealPlan(
    date: Date,
    mealType: string,
    options: RecommendationOptions = {}
  ): Promise<ScoredRecipe[]> {
    const params = new URLSearchParams();
    params.append('date', date.toISOString());
    params.append('mealType', mealType);
    
    Object.entries(options).forEach(([key, value]) => {
      if (value !== undefined) {
        if (Array.isArray(value)) {
          value.forEach(v => params.append(key, v));
        } else {
          params.append(key, value.toString());
        }
      }
    });

    return this.request<ScoredRecipe[]>(
      `/recommendations/meal-plan?${params.toString()}`
    );
  }

  async getRecipesByIngredients(
    ingredients: string[],
    options: {
      matchThreshold?: number;
      excludeIds?: string[];
      limit?: number;
    } = {}
  ): Promise<Recipe[]> {
    const params = new URLSearchParams();
    ingredients.forEach(ingredient => params.append('ingredients', ingredient));
    Object.entries(options).forEach(([key, value]) => {
      if (value !== undefined) {
        if (Array.isArray(value)) {
          value.forEach(v => params.append(key, v));
        } else {
          params.append(key, value.toString());
        }
      }
    });

    return this.request<Recipe[]>(`/recommendations/by-ingredients?${params.toString()}`);
  }

  async getContextualRecommendations(
    context: RecommendationContext
  ): Promise<ScoredRecipe[]> {
    return this.request<ScoredRecipe[]>('/recommendations/contextual', {
      method: 'POST',
      body: JSON.stringify(context),
    });
  }

  async getRecipesByPreferences(
    preferences: RecommendationContext['preferences'],
    limit: number = 10
  ): Promise<ScoredRecipe[]> {
    return this.request<ScoredRecipe[]>('/recommendations/preferences', {
      method: 'POST',
      body: JSON.stringify({ preferences, limit }),
    });
  }

  async getRecipesByDifficulty(
    difficulty: 'easy' | 'medium' | 'hard',
    limit: number = 10
  ): Promise<Recipe[]> {
    return this.request<Recipe[]>(`/recommendations/difficulty/${difficulty}?limit=${limit}`);
  }

  async getQuickRecipes(maxTime: number = 30, limit: number = 10): Promise<Recipe[]> {
    return this.request<Recipe[]>(`/recommendations/quick?maxTime=${maxTime}&limit=${limit}`);
  }

  async getRecipesByCuisine(cuisine: string, limit: number = 10): Promise<Recipe[]> {
    return this.request<Recipe[]>(`/recommendations/cuisine/${encodeURIComponent(cuisine)}?limit=${limit}`);
  }

  async getRecipesByDietaryRestrictions(
    restrictions: string[],
    limit: number = 10
  ): Promise<Recipe[]> {
    const params = new URLSearchParams();
    restrictions.forEach(r => params.append('restrictions', r));
    params.append('limit', limit.toString());

    return this.request<Recipe[]>(`/recommendations/dietary?${params.toString()}`);
  }

  async getRecipesByMealType(
    mealType: string,
    options: {
      date?: Date;
      preferences?: RecommendationContext['preferences'];
      limit?: number;
    } = {}
  ): Promise<ScoredRecipe[]> {
    const params = new URLSearchParams();
    if (options.date) {
      params.append('date', options.date.toISOString());
    }
    if (options.limit) {
      params.append('limit', options.limit.toString());
    }

    return this.request<ScoredRecipe[]>(`/recommendations/meal-type/${encodeURIComponent(mealType)}?${params.toString()}`, {
      method: 'POST',
      body: JSON.stringify({ preferences: options.preferences }),
    });
  }
}

export const recommendationService = RecommendationService.getInstance(); 
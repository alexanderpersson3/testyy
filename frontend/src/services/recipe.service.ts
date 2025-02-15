import { ObjectId } from 'mongodb';

// Types
export interface Recipe {
  _id: ObjectId;
  title: string;
  description: string;
  ingredients: Array<{
    name: string;
    amount: number;
    unit: string;
    notes?: string;
    productId?: string;
  }>;
  instructions: Array<{
    step: number;
    text: string;
    image?: string;
    timer?: {
      duration: number;
      unit: 'minutes' | 'hours';
    };
  }>;
  servings: number;
  prepTime: number;
  cookTime: number;
  totalTime?: number;
  difficulty: 'easy' | 'medium' | 'hard';
  cuisine?: string;
  tags: string[];
  images: string[];
  author?: {
    _id: ObjectId;
    name: string;
  };
  ratings?: {
    average: number;
    count: number;
  };
  stats?: {
    viewCount: number;
    saveCount: number;
    rating: number;
    likes: number;
    shares: number;
    comments: number;
  };
  nutritionalInfo?: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber: number;
    sugar: number;
  };
  dietaryInfo?: {
    vegetarian: boolean;
    vegan: boolean;
    glutenFree: boolean;
    dairyFree: boolean;
    nutFree: boolean;
  };
  seasons?: string[];
  language?: string;
  availableLanguages?: string[];
  createdAt?: Date;
  updatedAt?: Date;
}

export interface RecipeSearchQuery {
  text?: string;
  cuisine?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  tags?: string[];
  maxPrepTime?: number;
  minRating?: number;
  sortBy?: string;
  limit?: number;
  offset?: number;
}

export interface UserStats {
  recipesCount: number;
  savedRecipes: number;
  totalLikes: number;
  averageRating: number;
}

export interface UserActivity {
  type: 'like' | 'comment' | 'rating';
  recipe: Recipe;
  timestamp: Date;
  rating?: number;
}

class RecipeService {
  private static instance: RecipeService;
  private baseUrl: string;

  private constructor() {
    this.baseUrl = `${import.meta.env.VITE_API_URL}/recipes`;
  }

  public static getInstance(): RecipeService {
    if (!RecipeService.instance) {
      RecipeService.instance = new RecipeService();
    }
    return RecipeService.instance;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    try {
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
        const error = await response.json().catch(() => ({ message: 'Network error occurred' }));
        throw new Error(error.message || `HTTP error! status: ${response.status}`);
      }

      return response.json();
    } catch (error) {
      if (error instanceof TypeError && error.message === 'Failed to fetch') {
        throw new Error('Unable to connect to the server. Please check your connection and try again.');
      }
      throw error;
    }
  }

  // Search recipes
  async searchRecipes(query: RecipeSearchQuery): Promise<Recipe[]> {
    const params = new URLSearchParams();
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined) {
        if (Array.isArray(value)) {
          value.forEach(v => params.append(key, v.toString()));
        } else {
          params.append(key, value.toString());
        }
      }
    });

    return this.request<Recipe[]>(`/search?${params.toString()}`);
  }

  // Create recipe
  async createRecipe(recipe: FormData): Promise<{ recipeId: string }> {
    return this.request<{ recipeId: string }>('/', {
      method: 'POST',
      body: recipe, // FormData for multipart/form-data (file upload)
      headers: {}, // Let browser set content-type for FormData
    });
  }

  // Get recipe by ID
  async getRecipe(recipeId: string): Promise<Recipe> {
    return this.request<Recipe>(`/${recipeId}`);
  }

  // Update recipe
  async updateRecipe(recipeId: string, recipe: FormData): Promise<Recipe> {
    return this.request<Recipe>(`/${recipeId}`, {
      method: 'PUT',
      body: recipe, // FormData for multipart/form-data (file upload)
      headers: {}, // Let browser set content-type for FormData
    });
  }

  // Delete recipe
  async deleteRecipe(recipeId: string): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(`/${recipeId}`, {
      method: 'DELETE',
    });
  }

  // Like recipe
  async likeRecipe(recipeId: string): Promise<{ liked: boolean }> {
    return this.request<{ liked: boolean }>(`/${recipeId}/like`, {
      method: 'POST',
    });
  }

  // Add rating
  async addRating(recipeId: string, rating: number, comment?: string): Promise<void> {
    return this.request(`/${recipeId}/rating`, {
      method: 'POST',
      body: JSON.stringify({ rating, comment }),
    });
  }

  // Get ratings
  async getRatings(recipeId: string, page = 1, limit = 10): Promise<{
    ratings: Array<{
      userId: string;
      rating: number;
      comment?: string;
      createdAt: Date;
      user?: { _id: string; name: string };
    }>;
    total: number;
  }> {
    return this.request(`/${recipeId}/ratings?page=${page}&limit=${limit}`);
  }

  // Add comment
  async addComment(recipeId: string, comment: string): Promise<void> {
    return this.request(`/${recipeId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ comment }),
    });
  }

  // Get comments
  async getComments(recipeId: string, page = 1, limit = 10): Promise<{
    comments: Array<{
      userId: string;
      comment: string;
      createdAt: Date;
      user?: { _id: string; name: string };
    }>;
    total: number;
  }> {
    return this.request(`/${recipeId}/comments?page=${page}&limit=${limit}`);
  }

  // Update comment
  async updateComment(recipeId: string, commentId: string, comment: string): Promise<void> {
    return this.request(`/${recipeId}/comments/${commentId}`, {
      method: 'PUT',
      body: JSON.stringify({ comment }),
    });
  }

  // Delete comment
  async deleteComment(recipeId: string, commentId: string): Promise<void> {
    return this.request(`/${recipeId}/comments/${commentId}`, {
      method: 'DELETE',
    });
  }

  // Share recipe
  async shareRecipe(recipeId: string, platform: 'facebook' | 'twitter' | 'pinterest' | 'email'): Promise<void> {
    return this.request(`/${recipeId}/share`, {
      method: 'POST',
      body: JSON.stringify({ platform }),
    });
  }

  // Get recipe stats
  async getRecipeStats(recipeId: string): Promise<{
    viewCount: number;
    saveCount: number;
    rating: number;
    likes: number;
    shares: number;
    comments: number;
  }> {
    return this.request(`/${recipeId}/stats`);
  }

  // Save recipe to collection
  async saveRecipe(recipeId: string, collectionId?: string): Promise<void> {
    return this.request(`/${recipeId}/save`, {
      method: 'POST',
      body: JSON.stringify({ collectionId }),
    });
  }

  // Unsave recipe from collection
  async unsaveRecipe(recipeId: string): Promise<void> {
    return this.request(`/${recipeId}/save`, {
      method: 'DELETE',
    });
  }

  // Get saved recipes
  async getSavedRecipes(options: {
    page?: number;
    limit?: number;
    collectionId?: string;
  } = {}): Promise<{
    recipes: Recipe[];
    total: number;
  }> {
    const params = new URLSearchParams();
    Object.entries(options).forEach(([key, value]) => {
      if (value !== undefined) {
        params.append(key, value.toString());
      }
    });

    return this.request(`/saved?${params.toString()}`);
  }

  // Get recipes by author
  async getRecipesByAuthor(authorId: string, page = 1, limit = 10): Promise<{
    recipes: Recipe[];
    total: number;
  }> {
    return this.request(`/author/${authorId}?page=${page}&limit=${limit}`);
  }

  // Get recipes by tags
  async getRecipesByTags(tags: string[], page = 1, limit = 10): Promise<{
    recipes: Recipe[];
    total: number;
  }> {
    const params = new URLSearchParams();
    tags.forEach(tag => params.append('tags', tag));
    params.append('page', page.toString());
    params.append('limit', limit.toString());
    return this.request(`/tags?${params.toString()}`);
  }

  // Report recipe
  async reportRecipe(
    recipeId: string,
    reason: 'inappropriate' | 'copyright' | 'spam' | 'other',
    description?: string
  ): Promise<void> {
    return this.request(`/${recipeId}/report`, {
      method: 'POST',
      body: JSON.stringify({ reason, description }),
    });
  }

  // Create recipe remix
  async remixRecipe(originalRecipeId: string): Promise<{ recipeId: string }> {
    return this.request<{ recipeId: string }>(`/${originalRecipeId}/remix`, {
      method: 'POST',
    });
  }

  async getUserStats(userId: string): Promise<UserStats> {
    return this.request<UserStats>(`/users/${userId}/stats`);
  }

  async getUserActivity(userId: string): Promise<UserActivity[]> {
    return this.request<UserActivity[]>(`/users/${userId}/activity`);
  }
}

// Export the singleton instance
export const recipeService = RecipeService.getInstance();

export default recipeService;
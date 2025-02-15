import type { Recipe } from '../types/express.js';
import { ObjectId } from 'mongodb';;;;
/**
 * Collection visibility types
 */
export type CollectionVisibility = 'private' | 'shared' | 'public';

/**
 * Collection sort options
 */
export type CollectionSortOption =
  | 'name'
  | 'rating'
  | 'difficulty'
  | 'cookingTime'
  | 'created'
  | 'updated'
  | 'popularity'
  | 'custom';

/**
 * Recipe collection
 */
export interface RecipeCollection {
  _id?: ObjectId;
  userId: ObjectId;
  name: string;
  description?: string;
  visibility: CollectionVisibility;
  thumbnail?: string;
  tags: string[];
  recipes: CollectionRecipe[];
  collaborators?: CollectionCollaborator[];
  stats: CollectionStats;
  settings: CollectionSettings;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Collection recipe entry
 */
export interface CollectionRecipe {
  recipeId: ObjectId;
  position: number;
  notes?: string;
  tags?: string[];
  rating?: number;
  lastCooked?: Date;
  timesCooked?: number;
  isFavorite?: boolean;
  addedAt: Date;
}

/**
 * Collection collaborator
 */
export interface CollectionCollaborator {
  userId: ObjectId;
  role: 'viewer' | 'editor' | 'admin';
  addedAt: Date;
  addedBy: ObjectId;
  lastAccessed?: Date;
}

/**
 * Collection stats
 */
export interface CollectionStats {
  recipeCount: number;
  totalCookTime?: number;
  averageRating?: number;
  viewCount: number;
  saveCount: number;
  shareCount: number;
  lastCookedAt?: Date;
  popularTags: Array<{
    tag: string;
    count: number;
  }>;
}

/**
 * Collection settings
 */
export interface CollectionSettings {
  sortBy: CollectionSortOption;
  sortDirection: 'asc' | 'desc';
  defaultView: 'grid' | 'list' | 'detailed';
  showNotes: boolean;
  showRatings: boolean;
  showCookingHistory: boolean;
  enableNotifications: boolean;
  autoAddToGroceryList: boolean;
}

/**
 * Collection filters
 */
export interface CollectionFilters {
  visibility?: CollectionVisibility[];
  tags?: string[];
  hasRecipe?: string;
  minRecipes?: number;
  maxRecipes?: number;
  rating?: number;
  updatedSince?: Date;
  search?: string;
}

/**
 * Collection creation request
 */
export interface CreateCollectionRequest {
  name: string;
  description?: string;
  visibility: CollectionVisibility;
  thumbnail?: string;
  tags?: string[];
  settings?: Partial<CollectionSettings>;
}

/**
 * Collection update request
 */
export interface UpdateCollectionRequest {
  name?: string;
  description?: string;
  visibility?: CollectionVisibility;
  thumbnail?: string;
  tags?: string[];
  settings?: Partial<CollectionSettings>;
}

/**
 * Collection recipe addition request
 */
export interface AddRecipeRequest {
  recipeId: string;
  position?: number;
  notes?: string;
  tags?: string[];
}

/**
 * Collection recipe update request
 */
export interface UpdateRecipeRequest {
  position?: number;
  notes?: string;
  tags?: string[];
  rating?: number;
  isFavorite?: boolean;
}

/**
 * Collection collaborator addition request
 */
export interface AddCollaboratorRequest {
  userId: string;
  role: 'viewer' | 'editor' | 'admin';
}

/**
 * Collection share result
 */
export interface CollectionShareResult {
  url: string;
  expiresAt?: Date;
  accessCode?: string;
  qrCode?: string;
}

/**
 * Collection export format
 */
export type CollectionExportFormat = 'json' | 'pdf' | 'csv' | 'markdown';

/**
 * Collection export options
 */
export interface CollectionExportOptions {
  format: CollectionExportFormat;
  includeNotes?: boolean;
  includeRatings?: boolean;
  includeCookingHistory?: boolean;
  includeImages?: boolean;
  groupByTags?: boolean;
}

/**
 * Collection import result
 */
export interface CollectionImportResult {
  success: boolean;
  collectionId?: string;
  recipesImported: number;
  errors?: {
    recipe: string;
    error: string;
  }[];
}

/**
 * Collection analytics
 */
export interface CollectionAnalytics {
  collectionId: ObjectId;
  period: {
    start: Date;
    end: Date;
  };
  views: {
    total: number;
    unique: number;
    byDate: {
      date: Date;
      count: number;
    }[];
  };
  interactions: {
    saves: number;
    shares: number;
    recipes: {
      viewed: number;
      cooked: number;
      rated: number;
    };
  };
  popularRecipes: {
    recipeId: ObjectId;
    views: number;
    cooks: number;
    rating: number;
  }[];
  userSegments: {
    new: number;
    returning: number;
    geographic: {
      country: string;
      count: number;
    }[];
  };
}

/**
 * Recipe interface
 */
export interface Recipe {
  _id: ObjectId;
  title: string;
  description?: string;
  ingredients: Array<{
    name: string;
    amount: number;
    unit: string;
  }>;
  instructions: Array<{
    text: string;
    step: number;
  }>;
  difficulty: 'easy' | 'medium' | 'hard';
  totalTime: number;
  rating?: number;
  cuisine?: string;
  dietary?: string[];
  tags?: string[];
  viewCount?: number;
  createdAt: Date;
  updatedAt: Date;
}

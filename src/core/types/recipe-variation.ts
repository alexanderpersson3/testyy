import { ObjectId } from 'mongodb';;;;
import type { Recipe } from '../types/express.js';
export type VariationType = 'modification' | 'adaptation' | 'substitution' | 'scaling';

export interface VariationChange {
  field: string;
  oldValue: any;
  newValue: any;
  reason?: string;
}

export interface RecipeVariation {
  _id?: ObjectId;
  originalRecipeId: ObjectId;
  name: string;
  description: string;
  type: VariationType;
  changes: VariationChange[];
  status: 'draft' | 'published';
  authorId: ObjectId;
  reviews: number;
  isVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface VariationDocument extends RecipeVariation {
  _id: ObjectId;
}

export interface VariationReview {
  _id?: ObjectId;
  variationId: ObjectId;
  userId: ObjectId;
  rating: number;
  success: boolean;
  comment?: string;
  images?: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface VariationReviewDocument extends VariationReview {
  _id: ObjectId;
}

export interface VariationStats {
  _id?: ObjectId;
  variationId: ObjectId;
  views: number;
  saves: number;
  attempts: number;
  successRate: number;
  averageRating: number;
  ratingCount: number;
  lastAttempt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface VariationStatsDocument extends VariationStats {
  _id: ObjectId;
}

export interface CreateVariationRequest {
  originalRecipeId: string;
  name: string;
  description: string;
  type: VariationType;
  changes: VariationChange[];
}

export interface UpdateVariationRequest {
  name?: string;
  description?: string;
  type?: VariationType;
  changes?: VariationChange[];
  status?: 'draft' | 'published';
}

export interface VariationSuggestion {
  type: VariationType;
  description: string;
  changes: VariationChange[];
  confidence: number;
  reason?: string;
}

export interface VariationSearchQuery {
  originalRecipeId?: string;
  authorId?: string;
  type?: VariationType[];
  status?: ('draft' | 'published')[];
  isVerified?: boolean;
  minRating?: number;
  minSuccessRate?: number;
  sort?: 'rating' | 'attempts' | 'newest';
  limit?: number;
  offset?: number;
}

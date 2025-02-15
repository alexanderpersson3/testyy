;
;
import type { Collection } from 'mongodb';
import type { ObjectId } from '../types/express.js';
import { connectToDatabase } from '../db.js';;
import type { Recipe } from '../types/express.js';
import type { RecipeVariation, VariationDocument, VariationReviewDocument, VariationStatsDocument, CreateVariationRequest, UpdateVariationRequest } from '../types/express.js';
import { VariationReview, VariationStats, VariationSuggestion, VariationSearchQuery,  } from '../types/recipe-variation.js';;
import logger from '../utils/logger.js';

export class VariationsService {
  private static instance: VariationsService;
  private initialized: boolean = false;
  private recipesCollection!: Collection<Recipe>;
  private variationsCollection!: Collection<VariationDocument>;
  private reviewsCollection!: Collection<VariationReviewDocument>;
  private statsCollection!: Collection<VariationStatsDocument>;

  private constructor() {
    this.initialize().catch(error => {
      logger.error('Failed to initialize VariationsService:', error);
    });
  }

  private async initialize() {
    if (this.initialized) return;
    const db = await connectToDatabase();
    this.recipesCollection = db.collection<Recipe>('recipes');
    this.variationsCollection = db.collection<VariationDocument>('recipe_variations');
    this.reviewsCollection = db.collection<VariationReviewDocument>('variation_reviews');
    this.statsCollection = db.collection<VariationStatsDocument>('variation_stats');
    this.initialized = true;
    logger.info('VariationsService initialized successfully');
  }

  private async ensureInitialized() {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  public static getInstance(): VariationsService {
    if (!VariationsService.instance) {
      VariationsService.instance = new VariationsService();
    }
    return VariationsService.instance;
  }

  async createVariation(
    userId: string,
    request: CreateVariationRequest
  ): Promise<VariationDocument> {
    await this.ensureInitialized();

    const user = await this.recipesCollection.findOne({ _id: new ObjectId(userId) });
    if (!user) {
      throw new Error('User not found');
    }

    const variation: Omit<VariationDocument, '_id'> = {
      originalRecipeId: new ObjectId(request.originalRecipeId),
      name: request.name,
      description: request.description,
      type: request.type,
      changes: request.changes,
      status: 'draft',
      authorId: new ObjectId(userId),
      reviews: 0,
      isVerified: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await this.variationsCollection.insertOne(variation as VariationDocument);
    return { ...variation, _id: result.insertedId };
  }

  async updateVariation(
    userId: string,
    variationId: string,
    updates: UpdateVariationRequest
  ): Promise<VariationDocument> {
    await this.ensureInitialized();

    const currentVariation = await this.variationsCollection.findOne({
      _id: new ObjectId(variationId),
      authorId: new ObjectId(userId),
    });

    if (!currentVariation) {
      throw new Error('Variation not found or unauthorized');
    }

    const updatedVariation: Partial<VariationDocument> = {
      ...updates,
      updatedAt: new Date(),
    };

    const result = await this.variationsCollection.findOneAndUpdate(
      { _id: new ObjectId(variationId) },
      { $set: updatedVariation },
      { returnDocument: 'after' }
    );

    if (!result) {
      throw new Error('Failed to update variation');
    }

    // Ensure we return a complete VariationDocument
    return {
      ...currentVariation,
      ...updatedVariation,
      _id: currentVariation._id,
    } as VariationDocument;
  }

  async deleteVariation(userId: string, variationId: string): Promise<void> {
    await this.ensureInitialized();

    const result = await this.variationsCollection.deleteOne({
      _id: new ObjectId(variationId),
      authorId: new ObjectId(userId),
    });

    if (result.deletedCount === 0) {
      throw new Error('Variation not found or unauthorized');
    }
  }

  async getVariations(query: VariationSearchQuery): Promise<VariationDocument[]> {
    await this.ensureInitialized();

    const filter: any = {};

    if (query.originalRecipeId) {
      filter.originalRecipeId = new ObjectId(query.originalRecipeId);
    }

    if (query.authorId) {
      filter.authorId = new ObjectId(query.authorId);
    }

    if (query.type?.length) {
      filter.type = { $in: query.type };
    }

    if (query.status?.length) {
      filter.status = { $in: query.status };
    }

    if (query.isVerified !== undefined) {
      filter.isVerified = query.isVerified;
    }

    const cursor = this.variationsCollection.find(filter);

    if (query.sort) {
      switch (query.sort) {
        case 'rating':
          cursor.sort({ 'stats.averageRating': -1 });
          break;
        case 'attempts':
          cursor.sort({ 'stats.attempts': -1 });
          break;
        case 'newest':
          cursor.sort({ createdAt: -1 });
          break;
      }
    }

    if (query.offset) {
      cursor.skip(query.offset);
    }

    if (query.limit) {
      cursor.limit(query.limit);
    }

    return cursor.toArray();
  }

  async getSuggestions(recipeId: string): Promise<VariationSuggestion[]> {
    await this.ensureInitialized();

    const recipe = await this.recipesCollection.findOne({
      _id: new ObjectId(recipeId),
    });

    if (!recipe) {
      throw new Error('Recipe not found');
    }

    // Implementation of suggestion generation would go here
    return [];
  }

  async addReview(
    userId: string,
    variationId: string,
    review: Omit<VariationReview, '_id' | 'variationId' | 'userId' | 'createdAt' | 'updatedAt'>
  ): Promise<VariationReviewDocument> {
    await this.ensureInitialized();

    const newReview: Omit<VariationReviewDocument, '_id'> = {
      variationId: new ObjectId(variationId),
      userId: new ObjectId(userId),
      ...review,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await this.reviewsCollection.insertOne(newReview as VariationReviewDocument);
    await this.updateVariationStats(variationId);

    return { ...newReview, _id: result.insertedId };
  }

  async getStats(variationId: string): Promise<VariationStatsDocument> {
    await this.ensureInitialized();

    const stats = await this.statsCollection.findOne({
      variationId: new ObjectId(variationId),
    });

    if (!stats) {
      throw new Error('Stats not found');
    }

    return stats;
  }

  private async updateVariationStats(variationId: string): Promise<void> {
    await this.ensureInitialized();

    const reviews = await this.reviewsCollection
      .find({ variationId: new ObjectId(variationId) })
      .toArray();

    const successfulReviews = reviews.filter(review => review.success);
    const totalRating = reviews.reduce((sum: any, review: any) => sum + review.rating, 0);

    const stats: Omit<VariationStatsDocument, '_id'> = {
      variationId: new ObjectId(variationId),
      views: 0, // Would be updated elsewhere
      saves: 0, // Would be updated elsewhere
      attempts: reviews.length,
      successRate: reviews.length > 0 ? successfulReviews.length / reviews.length : 0,
      averageRating: reviews.length > 0 ? totalRating / reviews.length : 0,
      ratingCount: reviews.length,
      lastAttempt: reviews.length > 0 ? reviews[0].createdAt : undefined,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await this.statsCollection.updateOne(
      { variationId: new ObjectId(variationId) },
      { $set: stats },
      { upsert: true }
    );
  }
}

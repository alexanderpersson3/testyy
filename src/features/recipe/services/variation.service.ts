import type { Recipe } from '../types/express.js';
import { ObjectId } from 'mongodb';;;;
import { connectToDatabase } from '../db.js';;
import logger from '../utils/logger.js';
import type { RecipeChanges } from '../types/express.js';
import { Variation, VariationType, VariationRating } from '../types/variation.js';;
export class VariationService {
  private static instance: VariationService;

  private constructor() {}

  static getInstance(): VariationService {
    if (!VariationService.instance) {
      VariationService.instance = new VariationService();
    }
    return VariationService.instance;
  }

  async createVariation(data: {
    recipeId: ObjectId;
    name: string;
    description: string;
    changes: RecipeChanges;
    createdBy: ObjectId;
  }): Promise<Variation> {
    const db = await connectToDatabase();

    const newVariation: Omit<Variation, '_id'> = {
      ...data,
      ratings: [],
      averageRating: 0,
      successRate: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await db.collection<Variation>('variations').insertOne(newVariation);
    return { ...newVariation, _id: result.insertedId };
  }

  async getVariation(variationId: ObjectId): Promise<Variation | null> {
    const db = await connectToDatabase();
    return db.collection<Variation>('variations').findOne({ _id: variationId });
  }

  async getVariationsForRecipe(recipeId: ObjectId): Promise<Variation[]> {
    const db = await connectToDatabase();
    return db
      .collection<Variation>('variations')
      .find({ recipeId })
      .sort({ averageRating: -1 })
      .toArray();
  }

  async addRating(
    variationId: ObjectId,
    userId: ObjectId,
    rating: number,
    success: boolean,
    review?: string
  ): Promise<void> {
    const db = await connectToDatabase();

    const newRating: VariationRating = {
      userId,
      rating,
      success,
      review,
      createdAt: new Date(),
    };

    await db.collection<Variation>('variations').updateOne(
      { _id: variationId },
      {
        $push: { ratings: newRating },
        $set: { updatedAt: new Date() },
      }
    );

    // Update averages
    await this.updateAverages(variationId);
  }

  private async updateAverages(variationId: ObjectId): Promise<void> {
    const db = await connectToDatabase();

    const variation = await this.getVariation(variationId);
    if (!variation) return;

    const ratings = variation.ratings;
    if (ratings.length === 0) return;

    const averageRating =
      ratings.reduce((acc: number, curr: VariationRating) => acc + curr.rating, 0) / ratings.length;
    const successRate = ratings.filter((r: VariationRating) => r.success).length / ratings.length;

    await db.collection<Variation>('variations').updateOne(
      { _id: variationId },
      {
        $set: {
          averageRating,
          successRate,
          updatedAt: new Date(),
        },
      }
    );
  }

  async deleteVariation(variationId: ObjectId, userId: ObjectId): Promise<boolean> {
    const db = await connectToDatabase();

    const result = await db.collection<Variation>('variations').deleteOne({
      _id: variationId,
      createdBy: userId,
    });

    return result.deletedCount > 0;
  }
}

import { ObjectId } from 'mongodb';
;
import { connectToDatabase } from '../db.js';
import logger from '../utils/logger.js';
import { Variation, VariationType, VariationRating } from '../types/variation.js';
export class VariationService {
    constructor() { }
    static getInstance() {
        if (!VariationService.instance) {
            VariationService.instance = new VariationService();
        }
        return VariationService.instance;
    }
    async createVariation(data) {
        const db = await connectToDatabase();
        const newVariation = {
            ...data,
            ratings: [],
            averageRating: 0,
            successRate: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        const result = await db.collection('variations').insertOne(newVariation);
        return { ...newVariation, _id: result.insertedId };
    }
    async getVariation(variationId) {
        const db = await connectToDatabase();
        return db.collection('variations').findOne({ _id: variationId });
    }
    async getVariationsForRecipe(recipeId) {
        const db = await connectToDatabase();
        return db
            .collection('variations')
            .find({ recipeId })
            .sort({ averageRating: -1 })
            .toArray();
    }
    async addRating(variationId, userId, rating, success, review) {
        const db = await connectToDatabase();
        const newRating = {
            userId,
            rating,
            success,
            review,
            createdAt: new Date(),
        };
        await db.collection('variations').updateOne({ _id: variationId }, {
            $push: { ratings: newRating },
            $set: { updatedAt: new Date() },
        });
        // Update averages
        await this.updateAverages(variationId);
    }
    async updateAverages(variationId) {
        const db = await connectToDatabase();
        const variation = await this.getVariation(variationId);
        if (!variation)
            return;
        const ratings = variation.ratings;
        if (ratings.length === 0)
            return;
        const averageRating = ratings.reduce((acc, curr) => acc + curr.rating, 0) / ratings.length;
        const successRate = ratings.filter((r) => r.success).length / ratings.length;
        await db.collection('variations').updateOne({ _id: variationId }, {
            $set: {
                averageRating,
                successRate,
                updatedAt: new Date(),
            },
        });
    }
    async deleteVariation(variationId, userId) {
        const db = await connectToDatabase();
        const result = await db.collection('variations').deleteOne({
            _id: variationId,
            createdBy: userId,
        });
        return result.deletedCount > 0;
    }
}
//# sourceMappingURL=variation.service.js.map
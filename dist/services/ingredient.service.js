import { db, connectToDatabase } from '../db.js';
import { Ingredient, CreateIngredientDTO, UpdateIngredientDTO, IngredientSearchQuery, IngredientStats, IngredientWithPrices, CustomIngredient, } from '../types/ingredient.js';
export class IngredientService {
    constructor() { }
    static getInstance() {
        if (!IngredientService.instance) {
            IngredientService.instance = new IngredientService();
        }
        return IngredientService.instance;
    }
    /**
     * Get an ingredient with its current prices
     */
    async getIngredientWithPrices(ingredientId) {
        const ingredient = await this.getIngredient(ingredientId);
        if (!ingredient)
            return null;
        const latestPrice = ingredient.priceHistory?.[0];
        return {
            ...ingredient,
            prices: latestPrice
                ? [
                    {
                        store: {
                            _id: new ObjectId(),
                            name: latestPrice.store || 'Unknown Store',
                        },
                        price: latestPrice.price,
                        currency: latestPrice.currency,
                        quantity: 1,
                        unit: 'unit',
                    },
                ]
                : [],
        };
    }
    /**
     * Create a new ingredient
     */
    async createIngredient(userId, data) {
        const db = await connectToDatabase();
        const ingredient = {
            ...data,
            source: 'user',
            createdBy: new ObjectId(userId),
            isVerified: false,
            status: 'pending',
            tags: data.tags || [],
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        if (data.price) {
            ingredient.priceHistory = [
                {
                    price: data.price.amount,
                    currency: data.price.currency,
                    store: data.price.store,
                    date: new Date(),
                },
            ];
        }
        const result = await db.collection('ingredients').insertOne(ingredient);
        return result.insertedId;
    }
    /**
     * Get an ingredient by ID
     */
    async getIngredient(ingredientId) {
        const db = await connectToDatabase();
        return await db.collection('ingredients').findOne({
            _id: new ObjectId(ingredientId),
        });
    }
    /**
     * Update an ingredient
     */
    async updateIngredient(ingredientId, userId, data) {
        const db = await connectToDatabase();
        const ingredient = await this.getIngredient(ingredientId);
        if (!ingredient) {
            throw new Error('Ingredient not found');
        }
        if (ingredient.createdBy?.toString() !== userId) {
            throw new Error('Not authorized to update this ingredient');
        }
        const update = {
            $set: {
                ...data,
                updatedAt: new Date(),
            },
        };
        if (data.price) {
            update.$push = {
                priceHistory: {
                    price: data.price.amount,
                    currency: data.price.currency,
                    store: data.price.store,
                    date: new Date(),
                },
            };
        }
        await db
            .collection('ingredients')
            .updateOne({ _id: new ObjectId(ingredientId) }, update);
    }
    /**
     * Delete an ingredient
     */
    async deleteIngredient(ingredientId, userId) {
        const db = await connectToDatabase();
        const ingredient = await this.getIngredient(ingredientId);
        if (!ingredient) {
            throw new Error('Ingredient not found');
        }
        if (ingredient.createdBy?.toString() !== userId) {
            throw new Error('Not authorized to delete this ingredient');
        }
        await db.collection('ingredients').deleteOne({
            _id: new ObjectId(ingredientId),
        });
    }
    /**
     * Search ingredients
     */
    async searchIngredients(query) {
        const db = await connectToDatabase();
        const filter = {};
        if (query.query) {
            filter.$text = { $search: query.query };
        }
        if (query.category) {
            filter.category = query.category;
        }
        if (query.tags?.length) {
            filter.tags = { $all: query.tags };
        }
        if (query.source) {
            filter.source = query.source;
        }
        if (query.isVerified !== undefined) {
            filter.isVerified = query.isVerified;
        }
        if (query.dietaryPreferences) {
            const { vegan, vegetarian, glutenFree, dairyFree } = query.dietaryPreferences;
            if (vegan)
                filter['dietaryInfo.isVegan'] = true;
            if (vegetarian)
                filter['dietaryInfo.isVegetarian'] = true;
            if (glutenFree)
                filter['dietaryInfo.isGlutenFree'] = true;
            if (dairyFree)
                filter['dietaryInfo.isDairyFree'] = true;
        }
        if (query.allergenFree?.length) {
            filter.allergens = { $nin: query.allergenFree };
        }
        return await db
            .collection('ingredients')
            .find(filter)
            .sort({ createdAt: -1 })
            .skip(query.offset || 0)
            .limit(query.limit || 20)
            .toArray();
    }
    /**
     * Verify an ingredient
     */
    async verifyIngredient(ingredientId, verifierId) {
        const db = await connectToDatabase();
        await db.collection('ingredients').updateOne({ _id: new ObjectId(ingredientId) }, {
            $set: {
                isVerified: true,
                status: 'approved',
                verifiedBy: new ObjectId(verifierId),
                verifiedAt: new Date(),
                updatedAt: new Date(),
            },
        });
    }
    /**
     * Reject an ingredient
     */
    async rejectIngredient(ingredientId, verifierId) {
        const db = await connectToDatabase();
        await db.collection('ingredients').updateOne({ _id: new ObjectId(ingredientId) }, {
            $set: {
                status: 'rejected',
                verifiedBy: new ObjectId(verifierId),
                verifiedAt: new Date(),
                updatedAt: new Date(),
            },
        });
    }
    /**
     * Get ingredient statistics
     */
    async getStats() {
        const db = await connectToDatabase();
        const [totalIngredients, userSubmitted, verified, pendingVerification, categoryCounts, sourceCounts,] = await Promise.all([
            db.collection('ingredients').countDocuments(),
            db.collection('ingredients').countDocuments({ source: 'user' }),
            db.collection('ingredients').countDocuments({ isVerified: true }),
            db.collection('ingredients').countDocuments({ status: 'pending' }),
            db
                .collection('ingredients')
                .aggregate([{ $group: { _id: '$category', count: { $sum: 1 } } }])
                .toArray(),
            db
                .collection('ingredients')
                .aggregate([{ $group: { _id: '$source', count: { $sum: 1 } } }])
                .toArray(),
        ]);
        return {
            totalIngredients,
            userSubmitted,
            verified,
            pendingVerification,
            byCategory: Object.fromEntries(categoryCounts.map(({ _id, count }) => [_id || 'uncategorized', count])),
            bySource: Object.fromEntries(sourceCounts.map(({ _id, count }) => [_id, count])),
        };
    }
    /**
     * Create a custom ingredient
     */
    async createCustomIngredient(data) {
        const db = await connectToDatabase();
        const ingredient = {
            ...data,
            source: 'user',
            isVerified: false,
            status: data.status || 'pending',
            priceHistory: data.customPrice ? [{
                    price: data.customPrice,
                    currency: 'SEK',
                    store: data.store,
                    date: new Date()
                }] : [],
            createdAt: new Date(),
            updatedAt: new Date()
        };
        const result = await db.collection('ingredients').insertOne(ingredient);
        return result.insertedId;
    }
    /**
     * Get a user's custom ingredients
     */
    async getUserCustomIngredients(userId) {
        const db = await connectToDatabase();
        return await db
            .collection('ingredients')
            .find({
            userId: new ObjectId(userId),
            isCustom: true,
        })
            .toArray();
    }
    /**
     * Get a custom ingredient
     */
    async getCustomIngredient(ingredientId, userId) {
        const db = await connectToDatabase();
        return await db.collection('ingredients').findOne({
            _id: new ObjectId(ingredientId),
            userId: new ObjectId(userId),
            isCustom: true,
        });
    }
    /**
     * Update a custom ingredient
     */
    async updateCustomIngredient(ingredientId, userId, data) {
        const db = await connectToDatabase();
        const result = await db.collection('ingredients').updateOne({
            _id: new ObjectId(ingredientId),
            userId: new ObjectId(userId),
            isCustom: true,
        }, { $set: data });
        if (result.matchedCount === 0) {
            throw new Error('Custom ingredient not found');
        }
    }
    /**
     * Delete a custom ingredient
     */
    async deleteCustomIngredient(ingredientId, userId) {
        const db = await connectToDatabase();
        const result = await db.collection('ingredients').deleteOne({
            _id: new ObjectId(ingredientId),
            userId: new ObjectId(userId),
            isCustom: true,
        });
        return result.deletedCount > 0;
    }
}
//# sourceMappingURL=ingredient.service.js.map
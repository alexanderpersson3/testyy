import { DatabaseService } from '../db/database.service.js';
import { Ingredient, CreateIngredientDTO, UpdateIngredientDTO, SearchIngredientsQuery, ScrapedIngredient, Store, CustomPrice, IngredientWithPrices, IngredientSource, IngredientSearchQuery, } from '../types/ingredient.js';
import { ImageService } from '../image-service.js';
import CurrencyService from '../currency-service.js';
export class IngredientService {
    constructor() {
        this.db = DatabaseService.getInstance();
        this.imageService = new ImageService();
        this.currencyService = new CurrencyService();
    }
    static getInstance() {
        if (!IngredientService.instance) {
            IngredientService.instance = new IngredientService();
        }
        return IngredientService.instance;
    }
    /**
     * Get auto-complete suggestions
     */
    async getAutoCompleteSuggestions(query, userId, limit = 10) {
        // Create case-insensitive prefix regex
        const prefixRegex = new RegExp(`^${query}`, 'i');
        // Build filter
        const filter = {
            name: prefixRegex,
        };
        // Handle private ingredients
        if (userId) {
            filter.$or = [{ isPublic: true }, { createdBy: new ObjectId(userId) }];
        }
        else {
            filter.isPublic = true;
        }
        // Get suggestions with source priority (matspar first, then user)
        const suggestions = await this.db
            .getCollection('ingredients')
            .find(filter)
            .sort({
            source: 1, // matspar comes before user alphabetically
            name: 1,
        })
            .limit(limit)
            .project({
            _id: 1,
            name: 1,
            source: 1,
            description: 1,
            isPublic: 1,
        })
            .toArray();
        return {
            suggestions: suggestions.map(suggestion => ({
                id: suggestion._id.toString(),
                name: suggestion.name,
                source: suggestion.source,
                description: suggestion.description,
                isPublic: suggestion.isPublic ?? true,
            })),
        };
    }
    /**
     * Get ingredient with prices
     */
    async getIngredientWithPrices(ingredientId, targetCurrency) {
        const ingredient = await this.db.getCollection('ingredients').findOne({
            _id: new ObjectId(ingredientId),
        });
        if (!ingredient) {
            throw new Error('Ingredient not found');
        }
        // Get current prices
        const prices = await this.db
            .getCollection('scraped_ingredients')
            .aggregate([
            {
                $match: {
                    ingredientId: new ObjectId(ingredientId),
                    validTo: { $exists: false },
                },
            },
            {
                $lookup: {
                    from: 'stores',
                    localField: 'storeId',
                    foreignField: '_id',
                    as: 'store',
                },
            },
            {
                $unwind: '$store',
            },
        ])
            .toArray();
        // Convert prices if target currency specified
        const pricesWithConversion = await Promise.all(prices.map(async (price) => {
            let convertedPrice;
            if (targetCurrency && price.currency !== targetCurrency) {
                const converted = await this.currencyService.convert(price.price, price.currency, targetCurrency);
                convertedPrice = {
                    amount: converted,
                    currency: targetCurrency,
                };
            }
            return {
                store: {
                    _id: price.store._id,
                    name: price.store.name,
                    logo: price.store.logo,
                },
                price: price.price,
                currency: price.currency,
                quantity: price.quantity,
                unit: price.unit,
                convertedPrice,
            };
        }));
        return {
            ...ingredient,
            prices: pricesWithConversion,
        };
    }
    /**
     * Get upload URL for ingredient image
     */
    async uploadImage(file) {
        return await this.imageService.uploadImage(file);
    }
    /**
     * Create a new ingredient
     */
    async createIngredient(data) {
        const ingredient = {
            name: data.name,
            description: data.description,
            imageUrl: data.imageUrl,
            category: data.category,
            tags: data.tags || [],
            nutritionalInfo: data.nutritionalInfo,
            allergens: data.allergens || [],
            dietaryInfo: data.dietaryInfo || {
                isVegan: false,
                isVegetarian: false,
                isGlutenFree: false,
                isDairyFree: false,
            },
            source: 'system',
            isVerified: false,
            status: 'pending',
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
        const result = await this.db.getCollection('ingredients').insertOne(ingredient);
        return result.insertedId.toString();
    }
    /**
     * Create a user-submitted ingredient
     */
    async createUserIngredient(userId, data) {
        const ingredient = {
            name: data.name,
            description: data.description,
            imageUrl: data.imageUrl,
            category: data.category,
            tags: data.tags || [],
            nutritionalInfo: data.nutritionalInfo,
            allergens: data.allergens || [],
            dietaryInfo: data.dietaryInfo || {
                isVegan: false,
                isVegetarian: false,
                isGlutenFree: false,
                isDairyFree: false,
            },
            source: 'user',
            createdBy: new ObjectId(userId),
            isVerified: false,
            status: 'pending',
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
        const result = await this.db.getCollection('ingredients').insertOne(ingredient);
        return result.insertedId.toString();
    }
    /**
     * Get ingredient by ID
     */
    async getIngredient(id) {
        return this.db.getCollection('ingredients').findOne({
            _id: new ObjectId(id),
        });
    }
    /**
     * Get ingredient prices
     */
    async getIngredientPrices(ingredientId) {
        const prices = await this.db
            .getCollection('scraped_ingredients')
            .find({
            ingredientId: new ObjectId(ingredientId),
            validTo: { $exists: false },
        })
            .toArray();
        return prices;
    }
    /**
     * Upsert scraped ingredient
     */
    async upsertScrapedIngredient(storeId, externalId, data) {
        // Find or create ingredient
        let ingredient = await this.db.getCollection('ingredients').findOne({
            name: data.name,
            source: { $ne: 'user' },
        });
        if (!ingredient) {
            const newIngredient = {
                name: data.name,
                source: 'matspar',
                tags: [],
                isVerified: false,
                status: 'pending',
                createdAt: new Date(),
                updatedAt: new Date(),
            };
            const result = await this.db
                .getCollection('ingredients')
                .insertOne(newIngredient);
            ingredient = { _id: result.insertedId, ...newIngredient };
        }
        // Update existing price if found
        const existingPrice = await this.db
            .getCollection('scraped_ingredients')
            .findOne({
            ingredientId: ingredient._id,
            storeId: new ObjectId(storeId),
            externalId,
            validTo: { $exists: false },
        });
        if (existingPrice) {
            if (existingPrice.price !== data.price ||
                existingPrice.currency !== data.currency ||
                existingPrice.quantity !== data.quantity ||
                existingPrice.unit !== data.unit) {
                // Mark old price as invalid
                await this.db
                    .getCollection('scraped_ingredients')
                    .updateOne({ _id: existingPrice._id }, { $set: { validTo: new Date() } });
                // Insert new price
                const store = await this.db.getCollection('stores').findOne({
                    _id: new ObjectId(storeId),
                });
                if (!store) {
                    throw new Error('Store not found');
                }
                await this.db.getCollection('scraped_ingredients').insertOne({
                    ingredientId: ingredient._id,
                    storeId: new ObjectId(storeId),
                    externalId,
                    price: data.price,
                    currency: data.currency,
                    quantity: data.quantity,
                    unit: data.unit,
                    store: {
                        name: store.name,
                    },
                    validFrom: new Date(),
                    createdAt: new Date(),
                    updatedAt: new Date(),
                });
            }
        }
        else {
            // Insert new price
            const store = await this.db.getCollection('stores').findOne({
                _id: new ObjectId(storeId),
            });
            if (!store) {
                throw new Error('Store not found');
            }
            await this.db.getCollection('scraped_ingredients').insertOne({
                ingredientId: ingredient._id,
                storeId: new ObjectId(storeId),
                externalId,
                price: data.price,
                currency: data.currency,
                quantity: data.quantity,
                unit: data.unit,
                store: {
                    name: store.name,
                },
                validFrom: new Date(),
                createdAt: new Date(),
                updatedAt: new Date(),
            });
        }
    }
    /**
     * Delete an ingredient image
     */
    async deleteImage(url) {
        await this.imageService.deleteImage(url);
    }
    /**
     * Update an ingredient's custom price
     */
    async updateCustomPrice(ingredientId, customPrice) {
        const scrapedIngredient = {
            ingredientId: new ObjectId(ingredientId),
            storeId: new ObjectId(),
            price: customPrice.amount,
            currency: customPrice.currency,
            quantity: customPrice.quantity,
            unit: customPrice.unit,
            store: {
                name: 'Custom Price',
            },
            validFrom: new Date(),
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        // Update or insert custom price
        await this.db.getCollection('scraped_ingredients').updateOne({
            ingredientId: new ObjectId(ingredientId),
            'store.name': 'Custom Price',
        }, {
            $set: scrapedIngredient,
        }, { upsert: true });
    }
}
export default IngredientService;
//# sourceMappingURL=ingredient-service.js.map
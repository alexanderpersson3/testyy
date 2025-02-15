import { DatabaseService } from '../db/database.service.js';
import { Store, StoreProduct, StoreDeal } from '../types/store.js';
import logger from '../utils/logger.js';
export class MapService {
    constructor() {
        this.initialized = false;
        this.db = DatabaseService.getInstance();
    }
    static getInstance() {
        if (!MapService.instance) {
            MapService.instance = new MapService();
        }
        return MapService.instance;
    }
    async ensureInitialized() {
        if (!this.initialized) {
            this.storesCollection = this.db.getCollection('stores');
            this.productsCollection = this.db.getCollection('products');
            this.initialized = true;
        }
    }
    /**
     * Find stores near a location
     */
    async findNearbyStores(latitude, longitude, options = {}) {
        await this.ensureInitialized();
        const { maxDistance = 10000, limit = 10 } = options;
        return await this.storesCollection
            .find({
            location: {
                $near: {
                    $geometry: {
                        type: 'Point',
                        coordinates: [longitude, latitude],
                    },
                    $maxDistance: maxDistance,
                },
            },
        })
            .limit(limit)
            .toArray();
    }
    /**
     * Get store details with product availability
     */
    async getStoreDetails(storeId, options = {}) {
        try {
            await this.ensureInitialized();
            const store = await this.storesCollection.findOne({ _id: storeId });
            if (!store) {
                throw new Error('Store not found');
            }
            if (options.includeProducts) {
                const query = { storeId };
                if (options.productIds?.length) {
                    query.productId = { $in: options.productIds };
                }
                const products = await this.productsCollection
                    .aggregate([
                    { $match: query },
                    {
                        $lookup: {
                            from: 'products',
                            localField: 'productId',
                            foreignField: '_id',
                            as: 'product',
                        },
                    },
                    { $unwind: '$product' },
                ])
                    .toArray();
                return { ...store, products };
            }
            return store;
        }
        catch (error) {
            logger.error('Failed to get store details:', error);
            throw error;
        }
    }
    /**
     * Update store product availability
     */
    async updateProductAvailability(storeId, updates) {
        try {
            await this.ensureInitialized();
            const operations = updates.map(update => ({
                updateOne: {
                    filter: {
                        storeId,
                        productId: update.productId,
                    },
                    update: {
                        $set: {
                            inStock: update.inStock,
                            ...(update.price !== undefined && { price: update.price }),
                            ...(update.quantity !== undefined && { quantity: update.quantity }),
                            updatedAt: new Date(),
                        },
                    },
                    upsert: true,
                },
            }));
            await this.productsCollection.bulkWrite(operations);
        }
        catch (error) {
            logger.error('Failed to update product availability:', error);
            throw error;
        }
    }
    /**
     * Get product availability across stores
     */
    async getProductAvailability(productId, options = {}) {
        try {
            await this.ensureInitialized();
            const pipeline = [
                {
                    $match: {
                        productId,
                        inStock: true,
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
            ];
            if (options.latitude !== undefined && options.longitude !== undefined) {
                pipeline.push({
                    $match: {
                        'store.location.coordinates': {
                            $near: {
                                $geometry: {
                                    type: 'Point',
                                    coordinates: [options.longitude, options.latitude],
                                },
                                $maxDistance: options.maxDistance || 5000,
                            },
                        },
                    },
                });
            }
            if (options.limit) {
                pipeline.push({ $limit: options.limit });
            }
            const availability = await this.productsCollection
                .aggregate(pipeline)
                .toArray();
            return availability;
        }
        catch (error) {
            logger.error('Failed to get product availability:', error);
            throw error;
        }
    }
    async findStoresForRecipe(recipeId, coordinates) {
        await this.ensureInitialized();
        const recipe = await this.db.getCollection('recipes').findOne({
            _id: new ObjectId(recipeId),
        });
        if (!recipe) {
            throw new Error('Recipe not found');
        }
        const ingredientIds = recipe.ingredients.map((i) => new ObjectId(i._id));
        const nearbyStores = await this.findNearbyStores(coordinates.latitude, coordinates.longitude);
        const results = await Promise.all(nearbyStores.map(async (store) => {
            const products = await this.productsCollection
                .find({
                storeId: store._id,
                recipeIngredients: { $in: ingredientIds },
                inStock: true,
            })
                .toArray();
            const deals = store.deals?.filter(deal => products.some(product => product._id?.equals(deal.productId))) || [];
            return {
                store,
                availableIngredients: products.length,
                totalIngredients: ingredientIds.length,
                deals: deals.map(deal => {
                    const product = products.find(p => p._id?.equals(deal.productId));
                    return {
                        ingredient: product?.name || '',
                        discount: deal.discount,
                    };
                }),
            };
        }));
        // Sort by number of available ingredients and deals
        return results.sort((a, b) => {
            if (a.availableIngredients !== b.availableIngredients) {
                return b.availableIngredients - a.availableIngredients;
            }
            return (b.deals?.length || 0) - (a.deals?.length || 0);
        });
    }
    async getStoreBestDeals(storeId) {
        await this.ensureInitialized();
        const store = await this.storesCollection.findOne({
            _id: new ObjectId(storeId),
        });
        if (!store || !store.deals) {
            return [];
        }
        const activeDeals = store.deals.filter(deal => deal.endDate > new Date());
        const products = await this.productsCollection
            .find({
            _id: { $in: activeDeals.map(deal => deal.productId) },
        })
            .toArray();
        return activeDeals
            .map(deal => {
            const product = products.find(p => p._id?.equals(deal.productId));
            if (!product)
                return null;
            const productWithPrice = {
                _id: product._id,
                storeId: store._id,
                productId: product._id,
                name: product.name,
                inStock: true,
                price: {
                    price: product.price || 0,
                    currency: 'USD',
                    unit: product.unit || 'unit'
                },
                quantity: product.quantity || 1,
                unit: product.unit || 'unit',
                updatedAt: new Date()
            };
            return {
                product: productWithPrice,
                discount: deal.discount,
                originalPrice: productWithPrice.price.price,
                discountedPrice: productWithPrice.price.price * (1 - deal.discount / 100),
            };
        })
            .filter((item) => item !== null);
    }
    async updateStoreWaitTime(storeId, waitTime) {
        await this.ensureInitialized();
        await this.storesCollection.updateOne({ _id: new ObjectId(storeId) }, {
            $push: {
                waitTimeSamples: {
                    time: waitTime,
                    timestamp: new Date(),
                },
            },
            $set: {
                averageWaitTime: waitTime, // You might want to calculate a rolling average
                updatedAt: new Date(),
            },
        });
    }
    async addStoreDeal(storeId, productId, discount, startDate, endDate) {
        await this.ensureInitialized();
        await this.storesCollection.updateOne({ _id: new ObjectId(storeId) }, {
            $push: {
                deals: {
                    productId: new ObjectId(productId),
                    discount,
                    startDate,
                    endDate,
                },
            },
            $set: { updatedAt: new Date() },
        });
    }
    async getStoreProducts(storeId) {
        await this.ensureInitialized();
        const store = await this.storesCollection.findOne({ _id: storeId });
        if (!store) {
            throw new Error('Store not found');
        }
        const activeDeals = store.deals?.filter((deal) => deal.endDate > new Date()) || [];
        const products = await this.productsCollection
            .find({
            _id: { $in: activeDeals.map((deal) => deal.productId) },
        })
            .toArray();
        const storeProducts = [];
        for (const product of products) {
            if (!product._id)
                continue;
            const deal = activeDeals.find((d) => d.productId.equals(product._id));
            if (!deal)
                continue;
            storeProducts.push({
                _id: new ObjectId(),
                storeId,
                productId: product._id,
                name: product.name,
                inStock: true,
                price: product.price || 0,
                quantity: product.quantity || 1,
                unit: product.unit || 'unit',
                updatedAt: new Date(),
            });
        }
        return storeProducts;
    }
    async getStoreDeals(storeId) {
        await this.ensureInitialized();
        const store = await this.storesCollection.findOne({ _id: storeId });
        if (!store) {
            throw new Error('Store not found');
        }
        const activeDeals = store.deals?.filter((deal) => deal.endDate > new Date()) || [];
        const products = await this.productsCollection
            .find({
            _id: { $in: activeDeals.map((deal) => deal.productId) },
        })
            .toArray();
        const deals = [];
        for (const deal of activeDeals) {
            const product = products.find((p) => p._id?.equals(deal.productId));
            if (!product)
                continue;
            deals.push({
                productId: deal.productId,
                discount: deal.discount,
                startDate: deal.startDate,
                endDate: deal.endDate
            });
        }
        return deals;
    }
    async updateStoreLocation(storeId, latitude, longitude) {
        await this.ensureInitialized();
        await this.storesCollection.updateOne({ _id: storeId }, {
            $set: {
                location: {
                    type: 'Point',
                    coordinates: [longitude, latitude],
                },
                updatedAt: new Date(),
            },
        });
    }
    async updateStoreHours(storeId, hours) {
        await this.ensureInitialized();
        await this.storesCollection.updateOne({ _id: storeId }, {
            $set: {
                openingHours: hours,
                updatedAt: new Date(),
            },
        });
    }
}
//# sourceMappingURL=map-service.js.map
import { Store, StoreProduct, Product, StoreDeal, StoreWithDistance } from '../types/store.js';
import logger from '../utils/logger.js';
import { DatabaseError, NotFoundError } from '../utils/errors.js';
import { DatabaseService } from '../db/database.service.js';
export class MapService {
    constructor() {
        this.initialized = false;
        this.db = DatabaseService.getInstance();
        this.initialize().catch(error => {
            logger.error('Failed to initialize MapService:', error);
        });
    }
    async initialize() {
        if (this.initialized)
            return;
        try {
            await this.db.connect();
            this.storesCollection = this.db.getCollection('stores');
            this.productsCollection = this.db.getCollection('store_products');
            this.recipesCollection = this.db.getCollection('recipes');
            // Create geospatial index for store locations
            await this.storesCollection.createIndex({ location: '2dsphere' });
            this.initialized = true;
            logger.info('MapService initialized successfully');
        }
        catch (error) {
            logger.error('Failed to initialize MapService:', error);
            throw error;
        }
    }
    async ensureInitialized() {
        if (!this.initialized) {
            await this.initialize();
        }
    }
    static getInstance() {
        if (!MapService.instance) {
            MapService.instance = new MapService();
        }
        return MapService.instance;
    }
    async findNearbyStores(latitude, longitude, options = {}) {
        await this.ensureInitialized();
        const maxDistance = options.maxDistance || 10000; // 10km default
        const limit = options.limit || 20;
        try {
            const query = {
                location: {
                    $near: {
                        $geometry: {
                            type: 'Point',
                            coordinates: [longitude, latitude],
                        },
                        $maxDistance: maxDistance,
                    },
                },
            };
            if (options.filterByProducts?.length) {
                const availableStores = await this.productsCollection.distinct('storeId', {
                    productId: { $in: options.filterByProducts },
                    inStock: true,
                });
                query._id = { $in: availableStores };
            }
            const stores = await this.storesCollection.find(query).limit(limit).toArray();
            return stores.map(store => ({
                ...store,
                distance: this.calculateDistance(latitude, longitude, store.location.coordinates[1], store.location.coordinates[0]),
                currentDeals: store.deals?.length || 0,
            }));
        }
        catch (error) {
            logger.error('Failed to find nearby stores:', error);
            throw new DatabaseError('Failed to find nearby stores');
        }
    }
    async getStoreDeals(storeId) {
        await this.ensureInitialized();
        try {
            const store = await this.storesCollection.findOne({ _id: storeId });
            if (!store) {
                throw new NotFoundError('Store not found');
            }
            return store.deals || [];
        }
        catch (error) {
            if (error instanceof NotFoundError) {
                throw error;
            }
            logger.error('Failed to get store deals:', error);
            throw new DatabaseError('Failed to get store deals');
        }
    }
    async updateProductAvailability(storeId, updates) {
        await this.ensureInitialized();
        try {
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
            throw new DatabaseError('Failed to update product availability');
        }
    }
    async getProductAvailability(productId, options = {}) {
        await this.ensureInitialized();
        try {
            const pipeline = [{ $match: { productId } }];
            if (options.latitude && options.longitude) {
                pipeline.push({
                    $lookup: {
                        from: 'stores',
                        localField: 'storeId',
                        foreignField: '_id',
                        as: 'store',
                    },
                });
                pipeline.push({ $unwind: '$store' });
                if (options.maxDistance) {
                    pipeline.push({
                        $match: {
                            'store.location': {
                                $near: {
                                    $geometry: {
                                        type: 'Point',
                                        coordinates: [options.longitude, options.latitude],
                                    },
                                    $maxDistance: options.maxDistance,
                                },
                            },
                        },
                    });
                }
            }
            else {
                pipeline.push({
                    $lookup: {
                        from: 'stores',
                        localField: 'storeId',
                        foreignField: '_id',
                        as: 'store',
                    },
                });
                pipeline.push({ $unwind: '$store' });
            }
            if (options.limit) {
                pipeline.push({ $limit: options.limit });
            }
            const results = await this.productsCollection
                .aggregate(pipeline)
                .toArray();
            return results;
        }
        catch (error) {
            logger.error('Failed to get product availability:', error);
            throw new DatabaseError('Failed to get product availability');
        }
    }
    async getStoreProducts(storeId) {
        await this.ensureInitialized();
        try {
            return await this.productsCollection.find({ storeId }).toArray();
        }
        catch (error) {
            logger.error('Failed to get store products:', error);
            throw new DatabaseError('Failed to get store products');
        }
    }
    calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371; // Earth's radius in km
        const dLat = this.toRad(lat2 - lat1);
        const dLon = this.toRad(lon2 - lon1);
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(this.toRad(lat1)) *
                Math.cos(this.toRad(lat2)) *
                Math.sin(dLon / 2) *
                Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }
    toRad(degrees) {
        return degrees * (Math.PI / 180);
    }
    async processStoreProducts(store, products) {
        return products.map(product => ({
            ...product,
            store: {
                _id: store._id,
                name: store.name,
                type: store.type,
                location: store.location,
                address: store.address,
                openingHours: store.openingHours,
                createdAt: store.createdAt,
                updatedAt: store.updatedAt,
            },
        }));
    }
}
//# sourceMappingURL=map.service.js.map
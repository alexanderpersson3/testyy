export class StoreService {
    constructor(storesCollection, productsCollection, dealsCollection) {
        this.storesCollection = storesCollection;
        this.productsCollection = productsCollection;
        this.dealsCollection = dealsCollection;
    }
    // Store operations
    async getNearbyStores(coordinates, maxDistance = 10000, // 10km
    type) {
        const query = {
            'location.coordinates': {
                $near: {
                    $geometry: {
                        type: 'Point',
                        coordinates: coordinates
                    },
                    $maxDistance: maxDistance
                }
            }
        };
        if (type) {
            query.type = type;
        }
        return this.storesCollection.find(query).toArray();
    }
    async getStoresByWaitTime(maxWaitTime) {
        const query = maxWaitTime
            ? { averageWaitTime: { $lte: maxWaitTime } }
            : {};
        return this.storesCollection
            .find(query)
            .sort({ averageWaitTime: 1 })
            .toArray();
    }
    async getStoresWithDeals() {
        const storesWithDeals = await this.dealsCollection.distinct('storeId');
        return this.storesCollection
            .find({ _id: { $in: storesWithDeals } })
            .toArray();
    }
    // Product operations
    async getProducts(storeId, category, inStockOnly = false, page = 1, limit = 20) {
        const query = { storeId };
        if (category) {
            query.category = category;
        }
        if (inStockOnly) {
            query.inStock = true;
        }
        const [products, total] = await Promise.all([
            this.productsCollection
                .find(query)
                .skip((page - 1) * limit)
                .limit(limit)
                .toArray(),
            this.productsCollection.countDocuments(query)
        ]);
        return { products, total };
    }
    async getRelatedProducts(productId) {
        const product = await this.productsCollection.findOne({ _id: productId });
        if (!product || !product.relatedProducts) {
            return [];
        }
        return this.productsCollection
            .find({ _id: { $in: product.relatedProducts } })
            .toArray();
    }
    async getProductDeals(productId) {
        const currentDate = new Date();
        return this.dealsCollection
            .find({
            productId,
            startDate: { $lte: currentDate },
            endDate: { $gt: currentDate }
        })
            .toArray();
    }
    // Category operations
    async getCategories(storeId) {
        return this.productsCollection.distinct('category', { storeId });
    }
    async getSubcategories(storeId, category) {
        const subcategories = await this.productsCollection.distinct('subcategory', {
            storeId,
            category,
            subcategory: { $type: 'string' }
        });
        return subcategories.filter((sub) => typeof sub === 'string');
    }
    // Deal operations
    async getCurrentDeals(storeId, page = 1, limit = 20) {
        const currentDate = new Date();
        const query = {
            storeId,
            startDate: { $lte: currentDate },
            endDate: { $gt: currentDate }
        };
        const [deals, total] = await Promise.all([
            this.dealsCollection
                .find(query)
                .skip((page - 1) * limit)
                .limit(limit)
                .toArray(),
            this.dealsCollection.countDocuments(query)
        ]);
        return { deals, total };
    }
    async getBestDeals(limit = 10) {
        const currentDate = new Date();
        return this.dealsCollection
            .find({
            startDate: { $lte: currentDate },
            endDate: { $gt: currentDate },
            discountPercentage: { $exists: true }
        })
            .sort({ discountPercentage: -1 })
            .limit(limit)
            .toArray();
    }
}
//# sourceMappingURL=store.js.map
import express, { Request, Response } from 'express';
;
import { DatabaseService } from '../db/database.service.js';
import { auth } from '../middleware/auth.js';
import { Store, StoreProduct, StoreDeal, Product } from '../types/store.js';
import logger from '../utils/logger.js';
import { rateLimitMiddleware } from '../middleware/rate-limit.js';
const router = Router();
const db = DatabaseService.getInstance();
// Get all stores
router.get('/', rateLimitMiddleware.api(), async (_req, res) => {
    try {
        const stores = await db.getCollection('stores').find().toArray();
        res.json(stores);
    }
    catch (error) {
        logger.error('Failed to get stores:', error);
        res.status(500).json({ error: 'Failed to get stores' });
    }
});
// Get store by ID
router.get('/:id', rateLimitMiddleware.api(), async (req, res) => {
    try {
        const store = await db.getCollection('stores').findOne({
            _id: new ObjectId(req.params.id),
        });
        if (!store) {
            return res.status(404).json({ error: 'Store not found' });
        }
        res.json(store);
    }
    catch (error) {
        logger.error('Failed to get store:', error);
        res.status(500).json({ error: 'Failed to get store' });
    }
});
// Get store departments
router.get('/:id/departments', auth, rateLimitMiddleware.api(), async (req, res) => {
    try {
        const departments = await db
            .getCollection('departments')
            .find({ storeId: new ObjectId(req.params.id) })
            .toArray();
        const deptWithCounts = await Promise.all(departments.map(async (dept) => ({
            ...dept,
            products: await db.getCollection('products').countDocuments({
                storeId: new ObjectId(req.params.id),
                departmentId: dept._id,
            }),
        })));
        res.json(deptWithCounts);
    }
    catch (error) {
        logger.error('Failed to get departments:', error);
        res.status(500).json({ error: 'Failed to get departments' });
    }
});
// Get store favorites
router.get('/:id/favorites', auth, rateLimitMiddleware.api(), async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Authentication required' });
        }
        const favorites = await db
            .getCollection('favorites')
            .find({
            storeId: new ObjectId(req.params.id),
            userId: new ObjectId(req.user.id)
        })
            .toArray();
        res.json({
            favorites: favorites.map(favorite => ({
                ...favorite,
                _id: favorite._id.toString(),
            })),
        });
    }
    catch (error) {
        logger.error('Failed to get favorites:', error);
        res.status(500).json({ error: 'Failed to get favorites' });
    }
});
// Get store product locations
router.get('/:id/product-locations', auth, async (req, res) => {
    try {
        const productLocations = await db
            .getCollection('product_locations')
            .find({ storeId: new ObjectId(req.params.id) })
            .toArray();
        const locationMap = new Map(productLocations.map(loc => [
            loc.productId.toString(),
            { zone: loc.zone, zoneOrder: loc.zoneOrder },
        ]));
        const products = await db
            .getCollection('products')
            .find({ storeId: new ObjectId(req.params.id) })
            .toArray();
        const productsWithLocations = products.map(product => {
            const location = locationMap.get(product._id.toString()) || {
                zone: 'unknown',
                zoneOrder: 999,
            };
            return {
                ...product,
                _id: product._id.toString(),
                location,
            };
        });
        res.json(productsWithLocations);
    }
    catch (error) {
        logger.error('Failed to get product locations:', error);
        res.status(500).json({ error: 'Failed to get product locations' });
    }
});
// Get store products
router.get('/:id/products', async (req, res) => {
    try {
        const storeId = new ObjectId(req.params.id);
        const { department, category, query: searchQuery, sort = 'name', order = 'asc', page = '1', limit = '20', } = req.query;
        const pageNum = parseInt(page);
        const limitNum = Math.min(parseInt(limit), 100);
        const skip = (pageNum - 1) * limitNum;
        const matchQuery = {
            storeId,
            isAvailable: true,
        };
        if (department) {
            matchQuery.department = department;
        }
        if (category) {
            matchQuery.category = category;
        }
        if (searchQuery) {
            matchQuery.$or = [
                { name: { $regex: searchQuery, $options: 'i' } },
                { brand: { $regex: searchQuery, $options: 'i' } },
                { description: { $regex: searchQuery, $options: 'i' } },
            ];
        }
        const sortOptions = {
            [sort]: order === 'asc' ? 1 : -1,
        };
        const [products, total] = await Promise.all([
            db
                .getCollection('store_products')
                .find(matchQuery)
                .sort(sortOptions)
                .skip(skip)
                .limit(limitNum)
                .toArray(),
            db.getCollection('store_products').countDocuments(matchQuery),
        ]);
        res.json({
            products,
            total,
            page: pageNum,
            totalPages: Math.ceil(total / limitNum),
            hasMore: pageNum < Math.ceil(total / limitNum),
        });
    }
    catch (error) {
        logger.error('Failed to get store products:', error);
        res.status(500).json({ error: 'Failed to get store products' });
    }
});
// Get product details
router.get('/:storeId/products/:productId', async (req, res) => {
    try {
        const storeId = new ObjectId(req.params.storeId);
        const productId = new ObjectId(req.params.productId);
        // Get store product with product details
        const storeProduct = await db.getCollection('store_products').findOne({
            _id: productId,
            storeId,
        });
        if (!storeProduct) {
            return res.status(404).json({ message: 'Product not found' });
        }
        // Get product details
        const product = await db.getCollection('products').findOne({
            _id: storeProduct.productId
        });
        if (!product) {
            return res.status(404).json({ message: 'Product details not found' });
        }
        // Get price history
        const priceHistory = await db
            .getCollection('product_prices')
            .find({
            productId,
            storeId,
        })
            .sort({ date: -1 })
            .limit(30) // Last 30 price points
            .toArray();
        // Get similar products based on product category
        const similarProducts = await db
            .getCollection('store_products')
            .aggregate([
            {
                $match: {
                    storeId,
                    _id: { $ne: productId }
                }
            },
            {
                $lookup: {
                    from: 'products',
                    localField: 'productId',
                    foreignField: '_id',
                    as: 'product'
                }
            },
            {
                $unwind: '$product'
            },
            {
                $match: {
                    'product.category': product.category
                }
            },
            {
                $limit: 5
            }
        ])
            .toArray();
        res.json({
            product: {
                ...storeProduct,
                ...product
            },
            priceHistory,
            similarProducts: similarProducts.map(sp => ({
                ...sp,
                category: sp.product.category
            }))
        });
    }
    catch (error) {
        logger.error('Failed to get product details:', error);
        res.status(500).json({ error: 'Failed to get product details' });
    }
});
// Get store deals
router.get('/:id/deals', async (req, res) => {
    try {
        const storeId = new ObjectId(req.params.id);
        const now = new Date();
        const deals = await db
            .getCollection('store_deals')
            .find({
            storeId,
            startDate: { $lte: now },
            endDate: { $gte: now },
        })
            .sort({ endDate: 1 })
            .toArray();
        res.json(deals);
    }
    catch (error) {
        logger.error('Failed to get store deals:', error);
        res.status(500).json({ error: 'Failed to get store deals' });
    }
});
// Set default store
router.post('/:id/default', auth, rateLimitMiddleware.api(), async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Authentication required' });
        }
        const storeId = new ObjectId(req.params.id);
        // Verify store exists
        const store = await db.getCollection('stores').findOne({ _id: storeId });
        if (!store) {
            return res.status(404).json({ error: 'Store not found' });
        }
        // Update user's default store
        await db.getCollection('users').updateOne({ _id: new ObjectId(req.user.id) }, {
            $set: {
                defaultStoreId: storeId,
                updatedAt: new Date(),
            },
        });
        res.json({ success: true });
    }
    catch (error) {
        logger.error('Failed to set default store:', error);
        res.status(500).json({ error: 'Failed to set default store' });
    }
});
// Add store to favorites
router.post('/:id/favorite', auth, rateLimitMiddleware.api(), async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Authentication required' });
        }
        const storeId = new ObjectId(req.params.id);
        // Verify store exists
        const store = await db.getCollection('stores').findOne({ _id: storeId });
        if (!store) {
            return res.status(404).json({ error: 'Store not found' });
        }
        // Add to favorites
        const now = new Date();
        await db.getCollection('user_favorites').updateOne({
            userId: new ObjectId(req.user.id),
            storeId,
        }, {
            $setOnInsert: {
                createdAt: now,
            },
            $set: {
                updatedAt: now,
            },
        }, { upsert: true });
        res.json({ success: true });
    }
    catch (error) {
        logger.error('Failed to add store to favorites:', error);
        res.status(500).json({ error: 'Failed to add store to favorites' });
    }
});
// Remove store from favorites
router.delete('/:id/favorite', auth, rateLimitMiddleware.api(), async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'Authentication required' });
        }
        const result = await db.getCollection('user_favorites').deleteOne({
            userId: new ObjectId(req.user.id),
            storeId: new ObjectId(req.params.id),
        });
        if (result.deletedCount === 0) {
            return res.status(404).json({ error: 'Store not found in favorites' });
        }
        res.json({ success: true });
    }
    catch (error) {
        logger.error('Failed to remove store from favorites:', error);
        res.status(500).json({ error: 'Failed to remove store from favorites' });
    }
});
export default router;
//# sourceMappingURL=stores.js.map
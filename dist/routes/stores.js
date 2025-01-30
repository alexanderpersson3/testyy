import express from 'express';
import { check, validationResult } from 'express-validator';
import { ObjectId } from 'mongodb';
import { auth } from '../middleware/auth.js';
import { connectToDatabase } from '../db/db.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { StoreService } from '../services/store.js';
const router = express.Router();
// Get all stores
router.get('/', asyncHandler(async (req, res) => {
    const db = await connectToDatabase();
    const { lat, lng, radius = 10 } = req.query; // radius in kilometers
    const query = {};
    // If coordinates provided, find stores within radius
    if (lat && lng) {
        query.location = {
            $near: {
                $geometry: {
                    type: 'Point',
                    coordinates: [parseFloat(lng), parseFloat(lat)]
                },
                $maxDistance: parseInt(radius) * 1000 // convert to meters
            }
        };
    }
    const stores = await db.collection('stores')
        .find(query)
        .project({
        name: 1,
        address: 1,
        location: 1,
        openingHours: 1,
        phoneNumber: 1,
        website: 1,
        features: 1
    })
        .toArray();
    res.json({ stores });
}));
// Get store details
router.get('/:id', asyncHandler(async (req, res) => {
    const db = await connectToDatabase();
    const storeId = new ObjectId(req.params.id);
    const store = await db.collection('stores').findOne({ _id: storeId }, {
        projection: {
            name: 1,
            address: 1,
            location: 1,
            openingHours: 1,
            phoneNumber: 1,
            website: 1,
            features: 1,
            departments: 1
        }
    });
    if (!store) {
        return res.status(404).json({ message: 'Store not found' });
    }
    res.json({ store });
}));
// Get store products
router.get('/:id/products', asyncHandler(async (req, res) => {
    const db = await connectToDatabase();
    const storeId = new ObjectId(req.params.id);
    const { department, category, query, sort = 'name', order = 'asc', page = '1', limit = '20' } = req.query;
    const pageNum = parseInt(page);
    const limitNum = Math.min(parseInt(limit), 100);
    const skip = (pageNum - 1) * limitNum;
    const matchQuery = {
        storeId,
        isAvailable: true
    };
    if (department) {
        matchQuery.department = department;
    }
    if (category) {
        matchQuery.category = category;
    }
    if (query) {
        matchQuery.$or = [
            { name: { $regex: query, $options: 'i' } },
            { brand: { $regex: query, $options: 'i' } },
            { description: { $regex: query, $options: 'i' } }
        ];
    }
    const sortOptions = {
        [sort]: order === 'asc' ? 1 : -1
    };
    const [products, total] = await Promise.all([
        db.collection('store_products')
            .find(matchQuery)
            .sort(sortOptions)
            .skip(skip)
            .limit(limitNum)
            .toArray(),
        db.collection('store_products').countDocuments(matchQuery)
    ]);
    res.json({
        products,
        total,
        page: pageNum,
        totalPages: Math.ceil(total / limitNum),
        hasMore: pageNum < Math.ceil(total / limitNum)
    });
}));
// Get product details
router.get('/:storeId/products/:productId', asyncHandler(async (req, res) => {
    const db = await connectToDatabase();
    const storeId = new ObjectId(req.params.storeId);
    const productId = new ObjectId(req.params.productId);
    const product = await db.collection('store_products').findOne({
        _id: productId,
        storeId
    });
    if (!product) {
        return res.status(404).json({ message: 'Product not found' });
    }
    // Get price history
    const priceHistory = await db.collection('product_prices')
        .find({
        productId,
        storeId
    })
        .sort({ date: -1 })
        .limit(30) // Last 30 price points
        .toArray();
    // Get similar products
    const similarProducts = await db.collection('store_products')
        .find({
        _id: { $ne: productId },
        storeId,
        category: product.category,
        isAvailable: true
    })
        .limit(5)
        .toArray();
    res.json({
        product,
        priceHistory,
        similarProducts
    });
}));
// Set default store
router.post('/default', auth, [
    check('storeId').notEmpty()
], asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    const db = await connectToDatabase();
    const userId = new ObjectId(req.user.id);
    const storeId = new ObjectId(req.body.storeId);
    // Verify store exists
    const store = await db.collection('stores').findOne({ _id: storeId });
    if (!store) {
        return res.status(404).json({ message: 'Store not found' });
    }
    await db.collection('users').updateOne({ _id: userId }, {
        $set: {
            'settings.defaultStore': storeId,
            updatedAt: new Date()
        }
    });
    res.json({ success: true });
}));
// Get store departments and categories
router.get('/:id/departments', asyncHandler(async (req, res) => {
    const db = await connectToDatabase();
    const storeId = new ObjectId(req.params.id);
    const departments = await db.collection('store_products')
        .aggregate([
        {
            $match: {
                storeId,
                isAvailable: true
            }
        },
        {
            $group: {
                _id: '$department',
                categories: { $addToSet: '$category' },
                productCount: { $sum: 1 }
            }
        },
        {
            $sort: { _id: 1 }
        }
    ])
        .toArray();
    res.json({
        departments: departments.map(dept => ({
            name: dept._id,
            categories: dept.categories.sort(),
            productCount: dept.productCount
        }))
    });
}));
// Get store statistics
router.get('/:id/stats', asyncHandler(async (req, res) => {
    const db = await connectToDatabase();
    const storeId = new ObjectId(req.params.id);
    const [totalProducts, departmentStats, priceStats] = await Promise.all([
        db.collection('store_products').countDocuments({
            storeId,
            isAvailable: true
        }),
        db.collection('store_products')
            .aggregate([
            {
                $match: {
                    storeId,
                    isAvailable: true
                }
            },
            {
                $group: {
                    _id: '$department',
                    count: { $sum: 1 },
                    avgPrice: { $avg: '$price' }
                }
            }
        ])
            .toArray(),
        db.collection('store_products')
            .aggregate([
            {
                $match: {
                    storeId,
                    isAvailable: true
                }
            },
            {
                $group: {
                    _id: null,
                    avgPrice: { $avg: '$price' },
                    minPrice: { $min: '$price' },
                    maxPrice: { $max: '$price' }
                }
            }
        ])
            .toArray()
    ]);
    res.json({
        totalProducts,
        departmentStats,
        priceStats: priceStats[0] || {
            avgPrice: 0,
            minPrice: 0,
            maxPrice: 0
        }
    });
}));
// Get store's product categories
router.get('/:id/categories', asyncHandler(async (req, res) => {
    const db = await connectToDatabase();
    const storeId = new ObjectId(req.params.id);
    const categories = await db.collection('product_categories')
        .find({ storeId })
        .toArray();
    res.json({ categories });
}));
// Get products by category in a store
router.get('/:id/categories/:categoryId/products', asyncHandler(async (req, res) => {
    const db = await connectToDatabase();
    const storeId = new ObjectId(req.params.id);
    const categoryId = new ObjectId(req.params.categoryId);
    const products = await db.collection('products')
        .find({
        storeId,
        categoryId
    })
        .toArray();
    res.json({ products });
}));
// Get store's current promotions
router.get('/:id/promotions', asyncHandler(async (req, res) => {
    const db = await connectToDatabase();
    const storeId = new ObjectId(req.params.id);
    const promotions = await db.collection('promotions')
        .find({
        storeId,
        startDate: { $lte: new Date() },
        endDate: { $gte: new Date() }
    })
        .toArray();
    res.json({ promotions });
}));
// Get store's weekly flyer
router.get('/:id/flyer', asyncHandler(async (req, res) => {
    const db = await connectToDatabase();
    const storeId = new ObjectId(req.params.id);
    const flyer = await db.collection('flyers')
        .findOne({
        storeId,
        startDate: { $lte: new Date() },
        endDate: { $gte: new Date() }
    });
    if (!flyer) {
        return res.status(404).json({ message: 'No active flyer found' });
    }
    res.json({ flyer });
}));
// Admin routes below
// Create new store
router.post('/', auth, [
    check('name').trim().notEmpty(),
    check('chain').trim().notEmpty(),
    check('address').trim().notEmpty(),
    check('city').trim().notEmpty(),
    check('coordinates').isArray(),
    check('openingHours').isArray()
], asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    const db = await connectToDatabase();
    const store = {
        ...req.body,
        createdAt: new Date(),
        updatedAt: new Date()
    };
    const result = await db.collection('stores').insertOne(store);
    res.status(201).json({
        success: true,
        storeId: result.insertedId
    });
}));
// Update store
router.patch('/:id', auth, [
    check('name').optional().trim().notEmpty(),
    check('chain').optional().trim().notEmpty(),
    check('address').optional().trim().notEmpty(),
    check('city').optional().trim().notEmpty(),
    check('coordinates').optional().isArray(),
    check('openingHours').optional().isArray()
], asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    const db = await connectToDatabase();
    const updateData = {
        ...req.body,
        updatedAt: new Date()
    };
    await db.collection('stores').updateOne({ _id: new ObjectId(req.params.id) }, { $set: updateData });
    res.json({ success: true });
}));
// Set price alert
router.post('/:storeId/products/:productId/alert', auth, [
    check('targetPrice').isFloat({ min: 0 }),
    check('notifyBelow').optional().isBoolean(),
    check('notifyAbove').optional().isBoolean()
], asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    const db = await connectToDatabase();
    const userId = new ObjectId(req.user.id);
    const storeId = new ObjectId(req.params.storeId);
    const productId = new ObjectId(req.params.productId);
    // Verify product exists
    const product = await db.collection('store_products').findOne({
        _id: productId,
        storeId
    });
    if (!product) {
        return res.status(404).json({ message: 'Product not found' });
    }
    const alert = {
        userId,
        storeId,
        productId,
        targetPrice: parseFloat(req.body.targetPrice),
        notifyBelow: req.body.notifyBelow ?? true,
        notifyAbove: req.body.notifyAbove ?? false,
        isActive: true,
        createdAt: new Date(),
        lastNotifiedAt: null
    };
    await db.collection('price_alerts').insertOne(alert);
    res.json({ success: true });
}));
// Get user's price alerts
router.get('/price-alerts', auth, asyncHandler(async (req, res) => {
    const db = await connectToDatabase();
    const userId = new ObjectId(req.user.id);
    const alerts = await db.collection('price_alerts')
        .aggregate([
        {
            $match: {
                userId,
                isActive: true
            }
        },
        {
            $lookup: {
                from: 'store_products',
                localField: 'productId',
                foreignField: '_id',
                as: 'product'
            }
        },
        {
            $unwind: '$product'
        },
        {
            $lookup: {
                from: 'stores',
                localField: 'storeId',
                foreignField: '_id',
                as: 'store'
            }
        },
        {
            $unwind: '$store'
        }
    ])
        .toArray();
    res.json({ alerts });
}));
// Delete price alert
router.delete('/price-alerts/:alertId', auth, asyncHandler(async (req, res) => {
    const db = await connectToDatabase();
    const userId = new ObjectId(req.user.id);
    const alertId = new ObjectId(req.params.alertId);
    const result = await db.collection('price_alerts').deleteOne({
        _id: alertId,
        userId
    });
    if (result.deletedCount === 0) {
        return res.status(404).json({ message: 'Alert not found or unauthorized' });
    }
    res.json({ success: true });
}));
// Track product inventory
router.post('/:storeId/products/:productId/inventory', auth, [
    check('quantity').isInt({ min: 0 }),
    check('status').isIn(['in_stock', 'low_stock', 'out_of_stock']),
    check('location').optional().trim(),
    check('notes').optional().trim()
], asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    const db = await connectToDatabase();
    const storeId = new ObjectId(req.params.storeId);
    const productId = new ObjectId(req.params.productId);
    // Verify product exists
    const product = await db.collection('store_products').findOne({
        _id: productId,
        storeId
    });
    if (!product) {
        return res.status(404).json({ message: 'Product not found' });
    }
    const inventory = {
        storeId,
        productId,
        quantity: parseInt(req.body.quantity),
        status: req.body.status,
        location: req.body.location,
        notes: req.body.notes,
        updatedAt: new Date(),
        updatedBy: new ObjectId(req.user.id)
    };
    await db.collection('product_inventory').updateOne({ storeId, productId }, { $set: inventory }, { upsert: true });
    // Update product availability
    await db.collection('store_products').updateOne({ _id: productId }, {
        $set: {
            isAvailable: req.body.status !== 'out_of_stock',
            updatedAt: new Date()
        }
    });
    res.json({ success: true });
}));
// Get product inventory history
router.get('/:storeId/products/:productId/inventory/history', auth, asyncHandler(async (req, res) => {
    const db = await connectToDatabase();
    const storeId = new ObjectId(req.params.storeId);
    const productId = new ObjectId(req.params.productId);
    const history = await db.collection('product_inventory_history')
        .find({
        storeId,
        productId
    })
        .sort({ updatedAt: -1 })
        .limit(50)
        .toArray();
    res.json({ history });
}));
// Set low stock threshold
router.post('/:storeId/products/:productId/threshold', auth, [
    check('threshold').isInt({ min: 1 }),
    check('notifyOnLow').optional().isBoolean()
], asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    const db = await connectToDatabase();
    const storeId = new ObjectId(req.params.storeId);
    const productId = new ObjectId(req.params.productId);
    const threshold = {
        storeId,
        productId,
        threshold: parseInt(req.body.threshold),
        notifyOnLow: req.body.notifyOnLow ?? true,
        updatedAt: new Date(),
        updatedBy: new ObjectId(req.user.id)
    };
    await db.collection('inventory_thresholds').updateOne({ storeId, productId }, { $set: threshold }, { upsert: true });
    res.json({ success: true });
}));
// Get low stock alerts
router.get('/low-stock-alerts', auth, asyncHandler(async (req, res) => {
    const db = await connectToDatabase();
    const userId = new ObjectId(req.user.id);
    const alerts = await db.collection('product_inventory')
        .aggregate([
        {
            $lookup: {
                from: 'inventory_thresholds',
                let: { productId: '$productId', storeId: '$storeId' },
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $and: [
                                    { $eq: ['$productId', '$$productId'] },
                                    { $eq: ['$storeId', '$$storeId'] }
                                ]
                            }
                        }
                    }
                ],
                as: 'threshold'
            }
        },
        {
            $unwind: '$threshold'
        },
        {
            $match: {
                $expr: {
                    $lt: ['$quantity', '$threshold.threshold']
                },
                'threshold.notifyOnLow': true
            }
        },
        {
            $lookup: {
                from: 'store_products',
                localField: 'productId',
                foreignField: '_id',
                as: 'product'
            }
        },
        {
            $unwind: '$product'
        },
        {
            $lookup: {
                from: 'stores',
                localField: 'storeId',
                foreignField: '_id',
                as: 'store'
            }
        },
        {
            $unwind: '$store'
        }
    ])
        .toArray();
    res.json({ alerts });
}));
// Add store to favorites
router.post('/:id/favorite', auth, asyncHandler(async (req, res) => {
    const db = await connectToDatabase();
    const userId = new ObjectId(req.user.id);
    const storeId = new ObjectId(req.params.id);
    // Verify store exists
    const store = await db.collection('stores').findOne({ _id: storeId });
    if (!store) {
        return res.status(404).json({ message: 'Store not found' });
    }
    // Check if already favorited
    const existingFavorite = await db.collection('favorite_stores').findOne({
        userId,
        storeId
    });
    if (existingFavorite) {
        return res.status(400).json({ message: 'Store already in favorites' });
    }
    const favorite = {
        userId,
        storeId,
        createdAt: new Date()
    };
    await db.collection('favorite_stores').insertOne(favorite);
    res.json({ success: true });
}));
// Remove store from favorites
router.delete('/:id/favorite', auth, asyncHandler(async (req, res) => {
    const db = await connectToDatabase();
    const userId = new ObjectId(req.user.id);
    const storeId = new ObjectId(req.params.id);
    const result = await db.collection('favorite_stores').deleteOne({
        userId,
        storeId
    });
    if (result.deletedCount === 0) {
        return res.status(404).json({ message: 'Store not in favorites' });
    }
    res.json({ success: true });
}));
// Get user's favorite stores
router.get('/favorites', auth, asyncHandler(async (req, res) => {
    const db = await connectToDatabase();
    const userId = new ObjectId(req.user.id);
    const favorites = await db.collection('favorite_stores')
        .aggregate([
        {
            $match: { userId }
        },
        {
            $lookup: {
                from: 'stores',
                localField: 'storeId',
                foreignField: '_id',
                as: 'store'
            }
        },
        {
            $unwind: '$store'
        },
        {
            $sort: { createdAt: -1 }
        }
    ])
        .toArray();
    res.json({
        favorites: favorites.map(f => ({
            ...f.store,
            favoritedAt: f.createdAt
        }))
    });
}));
// Create shopping list
router.post('/shopping-lists', auth, [
    check('name').trim().notEmpty(),
    check('storeId').optional().isMongoId(),
    check('items').optional().isArray()
], asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    const db = await connectToDatabase();
    const userId = new ObjectId(req.user.id);
    const storeId = req.body.storeId ? new ObjectId(req.body.storeId) : null;
    // If store specified, verify it exists
    if (storeId) {
        const store = await db.collection('stores').findOne({ _id: storeId });
        if (!store) {
            return res.status(404).json({ message: 'Store not found' });
        }
    }
    const list = {
        userId,
        name: req.body.name,
        storeId,
        items: (req.body.items || []).map((item) => ({
            ...item,
            checked: false,
            addedAt: new Date()
        })),
        createdAt: new Date(),
        updatedAt: new Date()
    };
    const result = await db.collection('shopping_lists').insertOne(list);
    res.status(201).json({
        success: true,
        listId: result.insertedId
    });
}));
// Get user's shopping lists
router.get('/shopping-lists', auth, asyncHandler(async (req, res) => {
    const db = await connectToDatabase();
    const userId = new ObjectId(req.user.id);
    const lists = await db.collection('shopping_lists')
        .aggregate([
        {
            $match: { userId }
        },
        {
            $lookup: {
                from: 'stores',
                localField: 'storeId',
                foreignField: '_id',
                as: 'store'
            }
        },
        {
            $unwind: {
                path: '$store',
                preserveNullAndEmptyArrays: true
            }
        },
        {
            $sort: { updatedAt: -1 }
        }
    ])
        .toArray();
    res.json({ lists });
}));
// Update shopping list
router.put('/shopping-lists/:id', auth, [
    check('name').optional().trim().notEmpty(),
    check('storeId').optional().isMongoId(),
    check('items').optional().isArray()
], asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    const db = await connectToDatabase();
    const userId = new ObjectId(req.user.id);
    const listId = new ObjectId(req.params.id);
    // Verify list exists and belongs to user
    const list = await db.collection('shopping_lists').findOne({
        _id: listId,
        userId
    });
    if (!list) {
        return res.status(404).json({ message: 'Shopping list not found' });
    }
    const updateData = {
        updatedAt: new Date()
    };
    if (req.body.name)
        updateData.name = req.body.name;
    if (req.body.storeId) {
        const storeId = new ObjectId(req.body.storeId);
        const store = await db.collection('stores').findOne({ _id: storeId });
        if (!store) {
            return res.status(404).json({ message: 'Store not found' });
        }
        updateData.storeId = storeId;
    }
    if (req.body.items) {
        updateData.items = req.body.items.map((item) => ({
            ...item,
            addedAt: item.addedAt || new Date()
        }));
    }
    await db.collection('shopping_lists').updateOne({ _id: listId }, { $set: updateData });
    res.json({ success: true });
}));
// Delete shopping list
router.delete('/shopping-lists/:id', auth, asyncHandler(async (req, res) => {
    const db = await connectToDatabase();
    const userId = new ObjectId(req.user.id);
    const listId = new ObjectId(req.params.id);
    const result = await db.collection('shopping_lists').deleteOne({
        _id: listId,
        userId
    });
    if (result.deletedCount === 0) {
        return res.status(404).json({ message: 'Shopping list not found' });
    }
    res.json({ success: true });
}));
// Add item to shopping list
router.post('/shopping-lists/:id/items', auth, [
    check('productId').optional().isMongoId(),
    check('name').trim().notEmpty(),
    check('quantity').isFloat({ min: 0.1 }),
    check('unit').trim().notEmpty(),
    check('notes').optional().trim()
], asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    const db = await connectToDatabase();
    const userId = new ObjectId(req.user.id);
    const listId = new ObjectId(req.params.id);
    // Verify list exists and belongs to user
    const list = await db.collection('shopping_lists').findOne({
        _id: listId,
        userId
    });
    if (!list) {
        return res.status(404).json({ message: 'Shopping list not found' });
    }
    const item = {
        ...req.body,
        productId: req.body.productId ? new ObjectId(req.body.productId) : null,
        checked: false,
        addedAt: new Date()
    };
    await db.collection('shopping_lists').updateOne({ _id: listId }, {
        $push: { items: item },
        $set: { updatedAt: new Date() }
    });
    res.json({ success: true });
}));
// Update shopping list item
router.put('/shopping-lists/:id/items/:itemIndex', auth, [
    check('quantity').optional().isFloat({ min: 0.1 }),
    check('unit').optional().trim().notEmpty(),
    check('notes').optional().trim(),
    check('checked').optional().isBoolean()
], asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    const db = await connectToDatabase();
    const userId = new ObjectId(req.user.id);
    const listId = new ObjectId(req.params.id);
    const itemIndex = parseInt(req.params.itemIndex);
    // Verify list exists and belongs to user
    const list = await db.collection('shopping_lists').findOne({
        _id: listId,
        userId
    });
    if (!list) {
        return res.status(404).json({ message: 'Shopping list not found' });
    }
    if (itemIndex < 0 || itemIndex >= list.items.length) {
        return res.status(404).json({ message: 'Item not found' });
    }
    const updateData = {};
    Object.keys(req.body).forEach(key => {
        updateData[`items.${itemIndex}.${key}`] = req.body[key];
    });
    updateData.updatedAt = new Date();
    await db.collection('shopping_lists').updateOne({ _id: listId }, { $set: updateData });
    res.json({ success: true });
}));
// Remove item from shopping list
router.delete('/shopping-lists/:id/items/:itemIndex', auth, asyncHandler(async (req, res) => {
    const db = await connectToDatabase();
    const userId = new ObjectId(req.user.id);
    const listId = new ObjectId(req.params.id);
    const itemIndex = parseInt(req.params.itemIndex);
    // Verify list exists and belongs to user
    const list = await db.collection('shopping_lists').findOne({
        _id: listId,
        userId
    });
    if (!list) {
        return res.status(404).json({ message: 'Shopping list not found' });
    }
    if (itemIndex < 0 || itemIndex >= list.items.length) {
        return res.status(404).json({ message: 'Item not found' });
    }
    await db.collection('shopping_lists').updateOne({ _id: listId }, {
        $unset: { [`items.${itemIndex}`]: 1 },
        $set: { updatedAt: new Date() }
    });
    // Remove null items from the array using $pull with explicit type
    await db.collection('shopping_lists').updateOne({ _id: listId }, {
        $pull: {
            items: {
                $exists: true,
                $type: 10 // Type 10 is null in MongoDB
            }
        }
    });
    res.json({ success: true });
}));
// Generate shopping list from recipes
router.post('/shopping-lists/from-recipes', auth, [
    check('name').trim().notEmpty(),
    check('recipeIds').isArray().notEmpty(),
    check('servings').optional().isObject(),
    check('storeId').optional().isMongoId()
], asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    const db = await connectToDatabase();
    const userId = new ObjectId(req.user.id);
    const recipeIds = req.body.recipeIds.map((id) => new ObjectId(id));
    const storeId = req.body.storeId ? new ObjectId(req.body.storeId) : null;
    const servings = req.body.servings || {};
    // If store specified, verify it exists
    if (storeId) {
        const store = await db.collection('stores').findOne({ _id: storeId });
        if (!store) {
            return res.status(404).json({ message: 'Store not found' });
        }
    }
    // Get all recipes
    const recipes = await db.collection('recipes')
        .find({ _id: { $in: recipeIds } })
        .toArray();
    if (recipes.length !== recipeIds.length) {
        return res.status(404).json({ message: 'One or more recipes not found' });
    }
    // Aggregate ingredients from all recipes
    const ingredients = {};
    recipes.forEach(recipe => {
        const multiplier = servings[recipe._id.toString()]
            ? servings[recipe._id.toString()] / recipe.servings
            : 1;
        recipe.ingredients.forEach((ingredient) => {
            const key = `${ingredient.name.toLowerCase()}_${ingredient.unit}`;
            if (!ingredients[key]) {
                ingredients[key] = {
                    name: ingredient.name,
                    quantity: 0,
                    unit: ingredient.unit,
                    recipes: new Set()
                };
            }
            ingredients[key].quantity += ingredient.quantity * multiplier;
            ingredients[key].recipes.add(recipe.name);
        });
    });
    // Convert ingredients to shopping list items
    const items = Object.values(ingredients).map((ingredient) => ({
        name: ingredient.name,
        quantity: Math.ceil(ingredient.quantity * 100) / 100, // Round to 2 decimal places
        unit: ingredient.unit,
        notes: `For: ${Array.from(ingredient.recipes).join(', ')}`,
        checked: false,
        addedAt: new Date()
    }));
    // Create shopping list
    const list = {
        userId,
        name: req.body.name,
        storeId,
        items,
        generatedFrom: {
            recipes: recipes.map(r => ({
                id: r._id,
                name: r.name,
                servings: servings[r._id.toString()] || r.servings
            }))
        },
        createdAt: new Date(),
        updatedAt: new Date()
    };
    const result = await db.collection('shopping_lists').insertOne(list);
    res.status(201).json({
        success: true,
        listId: result.insertedId
    });
}));
// Get shopping list details with recipe information
router.get('/shopping-lists/:id/recipe-details', auth, asyncHandler(async (req, res) => {
    const db = await connectToDatabase();
    const userId = new ObjectId(req.user.id);
    const listId = new ObjectId(req.params.id);
    const list = await db.collection('shopping_lists')
        .aggregate([
        {
            $match: {
                _id: listId,
                userId
            }
        },
        {
            $lookup: {
                from: 'stores',
                localField: 'storeId',
                foreignField: '_id',
                as: 'store'
            }
        },
        {
            $unwind: {
                path: '$store',
                preserveNullAndEmptyArrays: true
            }
        }
    ])
        .next();
    if (!list) {
        return res.status(404).json({ message: 'Shopping list not found' });
    }
    // If list was generated from recipes, get recipe details
    if (list.generatedFrom?.recipes) {
        const recipeIds = list.generatedFrom.recipes.map((r) => new ObjectId(r.id));
        const recipes = await db.collection('recipes')
            .find({ _id: { $in: recipeIds } })
            .project({
            name: 1,
            servings: 1,
            ingredients: 1
        })
            .toArray();
        list.generatedFrom.recipeDetails = recipes;
    }
    res.json({ list });
}));
// Share shopping list
router.post('/shopping-lists/:id/share', auth, [
    check('email').isEmail(),
    check('permission').isIn(['view', 'edit'])
], asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    const db = await connectToDatabase();
    const userId = new ObjectId(req.user.id);
    const listId = new ObjectId(req.params.id);
    // Verify list exists and user owns it
    const list = await db.collection('shopping_lists').findOne({
        _id: listId,
        userId
    });
    if (!list) {
        return res.status(404).json({ message: 'Shopping list not found' });
    }
    // Get target user by email
    const targetUser = await db.collection('users').findOne({
        email: req.body.email.toLowerCase()
    });
    if (!targetUser) {
        return res.status(404).json({ message: 'User not found' });
    }
    // Check if already shared
    const existingShare = await db.collection('shopping_list_shares').findOne({
        listId,
        userId: targetUser._id
    });
    if (existingShare) {
        return res.status(400).json({ message: 'List already shared with this user' });
    }
    const share = {
        listId,
        userId: targetUser._id,
        sharedBy: userId,
        permission: req.body.permission,
        createdAt: new Date()
    };
    await Promise.all([
        db.collection('shopping_list_shares').insertOne(share),
        db.collection('user_activity').insertOne({
            userId,
            type: 'share_shopping_list',
            targetId: listId,
            targetUserId: targetUser._id,
            createdAt: new Date()
        })
    ]);
    res.json({ success: true });
}));
// Get shared shopping lists
router.get('/shopping-lists/shared', auth, asyncHandler(async (req, res) => {
    const db = await connectToDatabase();
    const userId = new ObjectId(req.user.id);
    const lists = await db.collection('shopping_list_shares')
        .aggregate([
        {
            $match: { userId }
        },
        {
            $lookup: {
                from: 'shopping_lists',
                localField: 'listId',
                foreignField: '_id',
                as: 'list'
            }
        },
        {
            $unwind: '$list'
        },
        {
            $lookup: {
                from: 'users',
                localField: 'list.userId',
                foreignField: '_id',
                as: 'owner'
            }
        },
        {
            $unwind: '$owner'
        },
        {
            $lookup: {
                from: 'stores',
                localField: 'list.storeId',
                foreignField: '_id',
                as: 'store'
            }
        },
        {
            $unwind: {
                path: '$store',
                preserveNullAndEmptyArrays: true
            }
        },
        {
            $project: {
                'owner.password': 0,
                'owner.email': 0
            }
        },
        {
            $sort: { 'list.updatedAt': -1 }
        }
    ])
        .toArray();
    res.json({ lists });
}));
// Remove shopping list share
router.delete('/shopping-lists/:id/share/:userId', auth, asyncHandler(async (req, res) => {
    const db = await connectToDatabase();
    const ownerId = new ObjectId(req.user.id);
    const listId = new ObjectId(req.params.id);
    const targetUserId = new ObjectId(req.params.userId);
    // Verify list exists and user owns it
    const list = await db.collection('shopping_lists').findOne({
        _id: listId,
        userId: ownerId
    });
    if (!list) {
        return res.status(404).json({ message: 'Shopping list not found' });
    }
    const result = await db.collection('shopping_list_shares').deleteOne({
        listId,
        userId: targetUserId
    });
    if (result.deletedCount === 0) {
        return res.status(404).json({ message: 'Share not found' });
    }
    res.json({ success: true });
}));
// Get shopping list collaborators
router.get('/shopping-lists/:id/collaborators', auth, asyncHandler(async (req, res) => {
    const db = await connectToDatabase();
    const userId = new ObjectId(req.user.id);
    const listId = new ObjectId(req.params.id);
    // Verify list exists and user has access
    const list = await db.collection('shopping_lists').findOne({
        _id: listId,
        userId
    });
    const share = await db.collection('shopping_list_shares').findOne({
        listId,
        userId
    });
    if (!list && !share) {
        return res.status(404).json({ message: 'Shopping list not found' });
    }
    const collaborators = await db.collection('shopping_list_shares')
        .aggregate([
        {
            $match: { listId }
        },
        {
            $lookup: {
                from: 'users',
                localField: 'userId',
                foreignField: '_id',
                as: 'user'
            }
        },
        {
            $unwind: '$user'
        },
        {
            $lookup: {
                from: 'users',
                localField: 'sharedBy',
                foreignField: '_id',
                as: 'sharedByUser'
            }
        },
        {
            $unwind: '$sharedByUser'
        },
        {
            $project: {
                'user.password': 0,
                'user.email': 0,
                'sharedByUser.password': 0,
                'sharedByUser.email': 0
            }
        }
    ])
        .toArray();
    res.json({ collaborators });
}));
// Update shopping list share permissions
router.put('/shopping-lists/:id/share/:userId', auth, [
    check('permission').isIn(['view', 'edit'])
], asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    const db = await connectToDatabase();
    const ownerId = new ObjectId(req.user.id);
    const listId = new ObjectId(req.params.id);
    const targetUserId = new ObjectId(req.params.userId);
    // Verify list exists and user owns it
    const list = await db.collection('shopping_lists').findOne({
        _id: listId,
        userId: ownerId
    });
    if (!list) {
        return res.status(404).json({ message: 'Shopping list not found' });
    }
    const result = await db.collection('shopping_list_shares').updateOne({
        listId,
        userId: targetUserId
    }, {
        $set: {
            permission: req.body.permission,
            updatedAt: new Date()
        }
    });
    if (result.matchedCount === 0) {
        return res.status(404).json({ message: 'Share not found' });
    }
    res.json({ success: true });
}));
// Add comment to shopping list
router.post('/shopping-lists/:id/comments', auth, [
    check('content').trim().notEmpty()
], asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    const db = await connectToDatabase();
    const userId = new ObjectId(req.user.id);
    const listId = new ObjectId(req.params.id);
    // Verify list exists and user has access
    const list = await db.collection('shopping_lists').findOne({
        _id: listId,
        userId
    });
    const share = await db.collection('shopping_list_shares').findOne({
        listId,
        userId
    });
    if (!list && !share) {
        return res.status(404).json({ message: 'Shopping list not found' });
    }
    const comment = {
        listId,
        userId,
        content: req.body.content,
        createdAt: new Date(),
        updatedAt: new Date()
    };
    const result = await db.collection('shopping_list_comments').insertOne(comment);
    // Add to activity feed
    await db.collection('user_activity').insertOne({
        userId,
        type: 'shopping_list_comment',
        targetId: listId,
        commentId: result.insertedId,
        createdAt: new Date()
    });
    res.status(201).json({
        success: true,
        commentId: result.insertedId
    });
}));
// Get shopping list comments
router.get('/shopping-lists/:id/comments', auth, asyncHandler(async (req, res) => {
    const db = await connectToDatabase();
    const userId = new ObjectId(req.user.id);
    const listId = new ObjectId(req.params.id);
    // Verify list exists and user has access
    const list = await db.collection('shopping_lists').findOne({
        _id: listId,
        userId
    });
    const share = await db.collection('shopping_list_shares').findOne({
        listId,
        userId
    });
    if (!list && !share) {
        return res.status(404).json({ message: 'Shopping list not found' });
    }
    const comments = await db.collection('shopping_list_comments')
        .aggregate([
        {
            $match: { listId }
        },
        {
            $lookup: {
                from: 'users',
                localField: 'userId',
                foreignField: '_id',
                as: 'user'
            }
        },
        {
            $unwind: '$user'
        },
        {
            $project: {
                'user.password': 0,
                'user.email': 0
            }
        },
        {
            $sort: { createdAt: -1 }
        }
    ])
        .toArray();
    res.json({ comments });
}));
// Get optimized shopping route
router.get('/shopping-lists/:id/route', auth, asyncHandler(async (req, res) => {
    const db = await connectToDatabase();
    const userId = new ObjectId(req.user.id);
    const listId = new ObjectId(req.params.id);
    // Get shopping list with store info
    const list = await db.collection('shopping_lists')
        .aggregate([
        {
            $match: {
                _id: listId,
                $or: [
                    { userId },
                    {
                        _id: {
                            $in: await db.collection('shopping_list_shares')
                                .find({ userId })
                                .map(s => s.listId)
                                .toArray()
                        }
                    }
                ]
            }
        },
        {
            $lookup: {
                from: 'stores',
                localField: 'storeId',
                foreignField: '_id',
                as: 'store'
            }
        },
        {
            $unwind: '$store'
        }
    ])
        .next();
    if (!list) {
        return res.status(404).json({ message: 'Shopping list not found' });
    }
    if (!list.storeId) {
        return res.status(400).json({ message: 'List is not associated with a store' });
    }
    // Get store layout and product locations
    const storeLayout = await db.collection('store_layouts').findOne({
        storeId: list.storeId
    });
    if (!storeLayout) {
        return res.status(404).json({ message: 'Store layout not found' });
    }
    // Get product locations for items in list
    const productIds = list.items
        .filter((item) => item.productId)
        .map((item) => item.productId);
    const productLocations = await db.collection('product_locations')
        .find({
        storeId: list.storeId,
        productId: { $in: productIds }
    })
        .toArray();
    // Create location map for quick lookup
    const locationMap = new Map(productLocations.map(loc => [loc.productId.toString(), loc]));
    // Group items by department/aisle
    const itemsByLocation = list.items.reduce((acc, item) => {
        const location = item.productId ? locationMap.get(item.productId.toString()) : null;
        const zone = location?.zone || 'unknown';
        if (!acc[zone]) {
            acc[zone] = {
                zone,
                zoneOrder: location?.zoneOrder || 999,
                items: []
            };
        }
        acc[zone].items.push({
            ...item,
            location: location || null
        });
        return acc;
    }, {});
    // Sort zones by optimal route
    const sortedZones = Object.values(itemsByLocation)
        .sort((a, b) => a.zoneOrder - b.zoneOrder);
    // For each zone, sort items by shelf location if available
    sortedZones.forEach((zone) => {
        zone.items.sort((a, b) => {
            if (!a.location || !b.location)
                return 0;
            if (a.location.aisle !== b.location.aisle) {
                return a.location.aisle - b.location.aisle;
            }
            return a.location.shelf - b.location.shelf;
        });
    });
    // Calculate estimated time and distance
    const estimatedTime = sortedZones.reduce((total, zone) => {
        // Base time per zone
        let zoneTime = 60; // 1 minute base time per zone
        // Add time per item in zone
        zoneTime += zone.items.length * 30; // 30 seconds per item
        return total + zoneTime;
    }, 0);
    const route = {
        store: {
            id: list.storeId,
            name: list.store.name,
            layout: storeLayout.layout
        },
        zones: sortedZones,
        stats: {
            totalZones: sortedZones.length,
            totalItems: list.items.length,
            itemsWithLocation: productLocations.length,
            estimatedTimeSeconds: estimatedTime,
            estimatedDistanceMeters: Math.round(estimatedTime / 60 * 50) // Rough estimate: 50m per minute
        }
    };
    res.json({ route });
}));
// Update product location in store
router.post('/:storeId/products/:productId/location', auth, [
    check('zone').trim().notEmpty(),
    check('zoneOrder').isInt({ min: 0 }),
    check('aisle').isInt({ min: 0 }),
    check('shelf').isInt({ min: 0 }),
    check('notes').optional().trim()
], asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    const db = await connectToDatabase();
    const storeId = new ObjectId(req.params.storeId);
    const productId = new ObjectId(req.params.productId);
    // Verify product exists
    const product = await db.collection('store_products').findOne({
        _id: productId,
        storeId
    });
    if (!product) {
        return res.status(404).json({ message: 'Product not found' });
    }
    const location = {
        storeId,
        productId,
        zone: req.body.zone,
        zoneOrder: req.body.zoneOrder,
        aisle: req.body.aisle,
        shelf: req.body.shelf,
        notes: req.body.notes,
        updatedAt: new Date(),
        updatedBy: new ObjectId(req.user.id)
    };
    await db.collection('product_locations').updateOne({ storeId, productId }, { $set: location }, { upsert: true });
    res.json({ success: true });
}));
// Get store layout
router.get('/:id/layout', asyncHandler(async (req, res) => {
    const db = await connectToDatabase();
    const storeId = new ObjectId(req.params.id);
    const layout = await db.collection('store_layouts').findOne({ storeId });
    if (!layout) {
        return res.status(404).json({ message: 'Store layout not found' });
    }
    res.json({ layout });
}));
// Update store layout
router.put('/:id/layout', auth, [
    check('layout').isObject(),
    check('zones').isArray()
], asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    const db = await connectToDatabase();
    const storeId = new ObjectId(req.params.id);
    const layoutData = {
        storeId,
        layout: req.body.layout,
        zones: req.body.zones,
        updatedAt: new Date(),
        updatedBy: new ObjectId(req.user.id)
    };
    await db.collection('store_layouts').updateOne({ storeId }, { $set: layoutData }, { upsert: true });
    res.json({ success: true });
}));
// Get nearby stores
router.get('/nearby', [
    check('lat').isFloat(),
    check('lng').isFloat(),
    check('maxDistance').optional().isInt({ min: 1 }),
    check('type').optional().isIn(['grocery', 'pharmacy', 'specialty'])
], asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    const db = await connectToDatabase();
    const storeService = new StoreService(db.collection('stores'), db.collection('products'), db.collection('deals'));
    const coordinates = [
        parseFloat(req.query.lng),
        parseFloat(req.query.lat)
    ];
    const maxDistance = req.query.maxDistance
        ? parseInt(req.query.maxDistance)
        : undefined;
    const stores = await storeService.getNearbyStores(coordinates, maxDistance, req.query.type);
    res.json({ stores });
}));
// Get stores by wait time
router.get('/wait-time', [
    check('maxWaitTime').optional().isInt({ min: 0 })
], asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    const db = await connectToDatabase();
    const storeService = new StoreService(db.collection('stores'), db.collection('products'), db.collection('deals'));
    const maxWaitTime = req.query.maxWaitTime
        ? parseInt(req.query.maxWaitTime)
        : undefined;
    const stores = await storeService.getStoresByWaitTime(maxWaitTime);
    res.json({ stores });
}));
// Get stores with deals
router.get('/with-deals', asyncHandler(async (req, res) => {
    const db = await connectToDatabase();
    const storeService = new StoreService(db.collection('stores'), db.collection('products'), db.collection('deals'));
    const stores = await storeService.getStoresWithDeals();
    res.json({ stores });
}));
// Get store products
router.get('/:storeId/products', [
    check('category').optional().trim(),
    check('inStockOnly').optional().isBoolean(),
    check('page').optional().isInt({ min: 1 }),
    check('limit').optional().isInt({ min: 1, max: 50 })
], asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    const db = await connectToDatabase();
    const storeService = new StoreService(db.collection('stores'), db.collection('products'), db.collection('deals'));
    const { products, total } = await storeService.getProducts(new ObjectId(req.params.storeId), req.query.category, req.query.inStockOnly === 'true', parseInt(req.query.page) || 1, parseInt(req.query.limit) || 20);
    res.json({
        products,
        total,
        page: parseInt(req.query.page) || 1,
        limit: parseInt(req.query.limit) || 20
    });
}));
// Get related products
router.get('/products/:productId/related', asyncHandler(async (req, res) => {
    const db = await connectToDatabase();
    const storeService = new StoreService(db.collection('stores'), db.collection('products'), db.collection('deals'));
    const products = await storeService.getRelatedProducts(new ObjectId(req.params.productId));
    res.json({ products });
}));
// Get product deals
router.get('/products/:productId/deals', asyncHandler(async (req, res) => {
    const db = await connectToDatabase();
    const storeService = new StoreService(db.collection('stores'), db.collection('products'), db.collection('deals'));
    const deals = await storeService.getProductDeals(new ObjectId(req.params.productId));
    res.json({ deals });
}));
// Get store categories
router.get('/:storeId/categories', asyncHandler(async (req, res) => {
    const db = await connectToDatabase();
    const storeService = new StoreService(db.collection('stores'), db.collection('products'), db.collection('deals'));
    const categories = await storeService.getCategories(new ObjectId(req.params.storeId));
    res.json({ categories });
}));
// Get store subcategories
router.get('/:storeId/categories/:category/subcategories', asyncHandler(async (req, res) => {
    const db = await connectToDatabase();
    const storeService = new StoreService(db.collection('stores'), db.collection('products'), db.collection('deals'));
    const subcategories = await storeService.getSubcategories(new ObjectId(req.params.storeId), req.params.category);
    res.json({ subcategories });
}));
// Get store deals
router.get('/:storeId/deals', [
    check('page').optional().isInt({ min: 1 }),
    check('limit').optional().isInt({ min: 1, max: 50 })
], asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    const db = await connectToDatabase();
    const storeService = new StoreService(db.collection('stores'), db.collection('products'), db.collection('deals'));
    const { deals, total } = await storeService.getCurrentDeals(new ObjectId(req.params.storeId), parseInt(req.query.page) || 1, parseInt(req.query.limit) || 20);
    res.json({
        deals,
        total,
        page: parseInt(req.query.page) || 1,
        limit: parseInt(req.query.limit) || 20
    });
}));
// Get best deals across all stores
router.get('/deals/best', [
    check('limit').optional().isInt({ min: 1, max: 50 })
], asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    const db = await connectToDatabase();
    const storeService = new StoreService(db.collection('stores'), db.collection('products'), db.collection('deals'));
    const deals = await storeService.getBestDeals(parseInt(req.query.limit) || 10);
    res.json({ deals });
}));
export default router;
//# sourceMappingURL=stores.js.map
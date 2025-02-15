import express from 'express';
;
import { ObjectId } from 'mongodb';
;
import { auth } from '../middleware/auth.js';
import { DatabaseService } from '../db/database.service.js';
import { asyncHandler, asyncAuthHandler } from '../utils/asyncHandler.js';
import { Product, ProductCategory } from '../types/store.js';
const router = express.Router();
const db = DatabaseService.getInstance();
// Get all products with filtering and pagination
router.get('/', asyncHandler(async (req, res) => {
    const page = parseInt(typeof req.query.page === 'string' ? req.query.page : '1');
    const limit = parseInt(typeof req.query.limit === 'string' ? req.query.limit : '20');
    const skip = (page - 1) * limit;
    const { storeId, categoryId, inStock, query } = req.query;
    const filter = {};
    if (storeId && typeof storeId === 'string')
        filter.storeId = new ObjectId(storeId);
    if (categoryId && typeof categoryId === 'string')
        filter.categoryId = new ObjectId(categoryId);
    if (inStock !== undefined)
        filter.inStock = inStock === 'true';
    if (query && typeof query === 'string') {
        filter.$or = [
            { name: { $regex: query, $options: 'i' } },
            { brand: { $regex: query, $options: 'i' } },
        ];
    }
    const products = await db.getCollection('products')
        .find(filter)
        .skip(skip)
        .limit(limit)
        .toArray();
    const total = await db.getCollection('products').countDocuments(filter);
    return res.json({
        products,
        page,
        totalPages: Math.ceil(total / limit),
        total,
    });
}));
// Get product by ID
router.get('/:id', asyncHandler(async (req, res) => {
    const product = await db.getCollection('products').findOne({
        _id: new ObjectId(req.params.id),
    });
    if (!product) {
        return res.status(404).json({ message: 'Product not found' });
    }
    return res.json({ product });
}));
// Get all categories
router.get('/categories', asyncHandler(async (req, res) => {
    const { storeId } = req.query;
    const filter = {};
    if (storeId && typeof storeId === 'string')
        filter.storeId = new ObjectId(storeId);
    const categories = await db.getCollection('product_categories')
        .find(filter)
        .sort({ order: 1 })
        .toArray();
    return res.json({ categories });
}));
// Get category by ID
router.get('/categories/:id', asyncHandler(async (req, res) => {
    const category = await db.getCollection('product_categories').findOne({
        _id: new ObjectId(req.params.id),
    });
    if (!category) {
        return res.status(404).json({ message: 'Category not found' });
    }
    return res.json({ category });
}));
// Admin routes below
// Create new product
router.post('/', auth, [
    check('storeId').notEmpty(),
    check('categoryId').notEmpty(),
    check('name').trim().notEmpty(),
    check('price').isNumeric(),
    check('unit').trim().notEmpty(),
    check('quantity').isNumeric(),
    check('inStock').isBoolean(),
], asyncAuthHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    const product = {
        ...req.body,
        storeId: new ObjectId(req.body.storeId),
        categoryId: new ObjectId(req.body.categoryId),
        createdAt: new Date(),
        updatedAt: new Date(),
    };
    const result = await db.getCollection('products').insertOne(product);
    return res.status(201).json({
        success: true,
        productId: result.insertedId,
    });
}));
// Update product
router.patch('/:id', auth, [
    check('name').optional().trim().notEmpty(),
    check('price').optional().isNumeric(),
    check('unit').optional().trim().notEmpty(),
    check('quantity').optional().isNumeric(),
    check('inStock').optional().isBoolean(),
], asyncAuthHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    const updateData = {
        ...req.body,
        updatedAt: new Date(),
    };
    await db.getCollection('products').updateOne({ _id: new ObjectId(req.params.id) }, { $set: updateData });
    return res.json({ success: true });
}));
// Create new category
router.post('/categories', auth, [check('storeId').notEmpty(), check('name').trim().notEmpty(), check('order').isNumeric()], asyncAuthHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    const category = {
        ...req.body,
        storeId: new ObjectId(req.body.storeId),
        parentId: req.body.parentId ? new ObjectId(req.body.parentId) : undefined,
        createdAt: new Date(),
        updatedAt: new Date(),
    };
    const result = await db.getCollection('product_categories').insertOne(category);
    return res.status(201).json({
        success: true,
        categoryId: result.insertedId,
    });
}));
// Update category
router.patch('/categories/:id', auth, [check('name').optional().trim().notEmpty(), check('order').optional().isNumeric()], asyncAuthHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    const updateData = {
        ...req.body,
        updatedAt: new Date(),
    };
    await db.getCollection('product_categories').updateOne({ _id: new ObjectId(req.params.id) }, { $set: updateData });
    return res.json({ success: true });
}));
export default router;
//# sourceMappingURL=products.js.map
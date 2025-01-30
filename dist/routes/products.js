import express from 'express';
import { check, validationResult } from 'express-validator';
import { ObjectId } from 'mongodb';
import { auth } from '../middleware/auth.js';
import { connectToDatabase } from '../db/db.js';
import { asyncHandler } from '../utils/asyncHandler.js';
const router = express.Router();
// Get all products with filtering and pagination
router.get('/', asyncHandler(async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const { storeId, categoryId, inStock, query } = req.query;
    const filter = {};
    if (storeId)
        filter.storeId = new ObjectId(storeId);
    if (categoryId)
        filter.categoryId = new ObjectId(categoryId);
    if (inStock !== undefined)
        filter.inStock = inStock === 'true';
    if (query) {
        filter.$or = [
            { name: { $regex: query, $options: 'i' } },
            { brand: { $regex: query, $options: 'i' } }
        ];
    }
    const db = await connectToDatabase();
    const products = await db.collection('products')
        .find(filter)
        .skip(skip)
        .limit(limit)
        .toArray();
    const total = await db.collection('products').countDocuments(filter);
    res.json({
        products,
        page,
        totalPages: Math.ceil(total / limit),
        total
    });
}));
// Get product by ID
router.get('/:id', asyncHandler(async (req, res) => {
    const db = await connectToDatabase();
    const product = await db.collection('products').findOne({
        _id: new ObjectId(req.params.id)
    });
    if (!product) {
        return res.status(404).json({ message: 'Product not found' });
    }
    res.json({ product });
}));
// Get all categories
router.get('/categories', asyncHandler(async (req, res) => {
    const db = await connectToDatabase();
    const { storeId } = req.query;
    const filter = {};
    if (storeId)
        filter.storeId = new ObjectId(storeId);
    const categories = await db.collection('product_categories')
        .find(filter)
        .sort({ order: 1 })
        .toArray();
    res.json({ categories });
}));
// Get category by ID
router.get('/categories/:id', asyncHandler(async (req, res) => {
    const db = await connectToDatabase();
    const category = await db.collection('product_categories').findOne({
        _id: new ObjectId(req.params.id)
    });
    if (!category) {
        return res.status(404).json({ message: 'Category not found' });
    }
    res.json({ category });
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
    check('inStock').isBoolean()
], asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    const db = await connectToDatabase();
    const product = {
        ...req.body,
        storeId: new ObjectId(req.body.storeId),
        categoryId: new ObjectId(req.body.categoryId),
        createdAt: new Date(),
        updatedAt: new Date()
    };
    const result = await db.collection('products').insertOne(product);
    res.status(201).json({
        success: true,
        productId: result.insertedId
    });
}));
// Update product
router.patch('/:id', auth, [
    check('name').optional().trim().notEmpty(),
    check('price').optional().isNumeric(),
    check('unit').optional().trim().notEmpty(),
    check('quantity').optional().isNumeric(),
    check('inStock').optional().isBoolean()
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
    await db.collection('products').updateOne({ _id: new ObjectId(req.params.id) }, { $set: updateData });
    res.json({ success: true });
}));
// Create new category
router.post('/categories', auth, [
    check('storeId').notEmpty(),
    check('name').trim().notEmpty(),
    check('order').isNumeric()
], asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    const db = await connectToDatabase();
    const category = {
        ...req.body,
        storeId: new ObjectId(req.body.storeId),
        parentId: req.body.parentId ? new ObjectId(req.body.parentId) : undefined,
        createdAt: new Date(),
        updatedAt: new Date()
    };
    const result = await db.collection('product_categories').insertOne(category);
    res.status(201).json({
        success: true,
        categoryId: result.insertedId
    });
}));
// Update category
router.patch('/categories/:id', auth, [
    check('name').optional().trim().notEmpty(),
    check('order').optional().isNumeric()
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
    await db.collection('product_categories').updateOne({ _id: new ObjectId(req.params.id) }, { $set: updateData });
    res.json({ success: true });
}));
export default router;
//# sourceMappingURL=products.js.map
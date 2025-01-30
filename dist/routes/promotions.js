import express from 'express';
import { check, validationResult } from 'express-validator';
import { ObjectId } from 'mongodb';
import { auth } from '../middleware/auth.js';
import { connectToDatabase } from '../db/db.js';
import { asyncHandler } from '../utils/asyncHandler.js';
const router = express.Router();
// Get all active promotions
router.get('/', asyncHandler(async (req, res) => {
    const { storeId, type } = req.query;
    const filter = {
        startDate: { $lte: new Date() },
        endDate: { $gte: new Date() }
    };
    if (storeId)
        filter.storeId = new ObjectId(storeId);
    if (type)
        filter.type = type;
    const db = await connectToDatabase();
    const promotions = await db.collection('promotions')
        .find(filter)
        .toArray();
    res.json({ promotions });
}));
// Get promotion by ID
router.get('/:id', asyncHandler(async (req, res) => {
    const db = await connectToDatabase();
    const promotion = await db.collection('promotions').findOne({
        _id: new ObjectId(req.params.id)
    });
    if (!promotion) {
        return res.status(404).json({ message: 'Promotion not found' });
    }
    res.json({ promotion });
}));
// Get all active flyers
router.get('/flyers', asyncHandler(async (req, res) => {
    const { storeId } = req.query;
    const filter = {
        startDate: { $lte: new Date() },
        endDate: { $gte: new Date() }
    };
    if (storeId)
        filter.storeId = new ObjectId(storeId);
    const db = await connectToDatabase();
    const flyers = await db.collection('flyers')
        .find(filter)
        .toArray();
    res.json({ flyers });
}));
// Get flyer by ID
router.get('/flyers/:id', asyncHandler(async (req, res) => {
    const db = await connectToDatabase();
    const flyer = await db.collection('flyers').findOne({
        _id: new ObjectId(req.params.id)
    });
    if (!flyer) {
        return res.status(404).json({ message: 'Flyer not found' });
    }
    res.json({ flyer });
}));
// Admin routes below
// Create new promotion
router.post('/', auth, [
    check('storeId').notEmpty(),
    check('productId').notEmpty(),
    check('type').isIn(['discount', 'bogo', 'bundle']),
    check('description').trim().notEmpty(),
    check('startDate').isISO8601(),
    check('endDate').isISO8601(),
    check('discountPercent').optional().isFloat({ min: 0, max: 100 }),
    check('discountAmount').optional().isFloat({ min: 0 })
], asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    const db = await connectToDatabase();
    const promotion = {
        ...req.body,
        storeId: new ObjectId(req.body.storeId),
        productId: new ObjectId(req.body.productId),
        startDate: new Date(req.body.startDate),
        endDate: new Date(req.body.endDate),
        createdAt: new Date(),
        updatedAt: new Date()
    };
    const result = await db.collection('promotions').insertOne(promotion);
    res.status(201).json({
        success: true,
        promotionId: result.insertedId
    });
}));
// Update promotion
router.patch('/:id', auth, [
    check('description').optional().trim().notEmpty(),
    check('startDate').optional().isISO8601(),
    check('endDate').optional().isISO8601(),
    check('discountPercent').optional().isFloat({ min: 0, max: 100 }),
    check('discountAmount').optional().isFloat({ min: 0 })
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
    if (updateData.startDate)
        updateData.startDate = new Date(updateData.startDate);
    if (updateData.endDate)
        updateData.endDate = new Date(updateData.endDate);
    await db.collection('promotions').updateOne({ _id: new ObjectId(req.params.id) }, { $set: updateData });
    res.json({ success: true });
}));
// Create new flyer
router.post('/flyers', auth, [
    check('storeId').notEmpty(),
    check('title').trim().notEmpty(),
    check('pdfUrl').isURL(),
    check('startDate').isISO8601(),
    check('endDate').isISO8601()
], asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    const db = await connectToDatabase();
    const flyer = {
        ...req.body,
        storeId: new ObjectId(req.body.storeId),
        startDate: new Date(req.body.startDate),
        endDate: new Date(req.body.endDate),
        createdAt: new Date(),
        updatedAt: new Date()
    };
    const result = await db.collection('flyers').insertOne(flyer);
    res.status(201).json({
        success: true,
        flyerId: result.insertedId
    });
}));
// Update flyer
router.patch('/flyers/:id', auth, [
    check('title').optional().trim().notEmpty(),
    check('pdfUrl').optional().isURL(),
    check('startDate').optional().isISO8601(),
    check('endDate').optional().isISO8601()
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
    if (updateData.startDate)
        updateData.startDate = new Date(updateData.startDate);
    if (updateData.endDate)
        updateData.endDate = new Date(updateData.endDate);
    await db.collection('flyers').updateOne({ _id: new ObjectId(req.params.id) }, { $set: updateData });
    res.json({ success: true });
}));
export default router;
//# sourceMappingURL=promotions.js.map
import express from 'express';
import { z } from 'zod';
import { ObjectId } from 'mongodb';
;
import { auth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { PriceTrackingService } from '../services/price-tracking.service.js';
const router = express.Router();
const priceTrackingService = PriceTrackingService.getInstance();
// Validation schemas
const createPriceAlertSchema = z.object({
    productId: z.string().regex(/^[0-9a-fA-F]{24}$/),
    storeId: z.string().regex(/^[0-9a-fA-F]{24}$/),
    targetPrice: z.number().positive(),
});
const updatePriceAlertSchema = z.object({
    targetPrice: z.number().positive().optional(),
    isActive: z.boolean().optional(),
}).refine(data => Object.keys(data).length > 0, {
    message: 'At least one field must be provided',
});
const trackPriceSchema = z.object({
    productId: z.string().regex(/^[0-9a-fA-F]{24}$/),
    storeId: z.string().regex(/^[0-9a-fA-F]{24}$/),
    price: z.number().positive(),
    currency: z.string().length(3),
    inStock: z.boolean(),
});
const getPriceHistorySchema = z.object({
    days: z.coerce.number().min(1).max(365).optional(),
});
const findBestPricesSchema = z.object({
    productIds: z.array(z.string().regex(/^[0-9a-fA-F]{24}$/)),
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    maxDistance: z.coerce.number().positive().optional(),
});
// Routes
router.post('/alerts', auth, validate(createPriceAlertSchema), (async (req, res) => {
    const alert = await priceTrackingService.createPriceAlert(new ObjectId(req.user.id), new ObjectId(req.body.productId), new ObjectId(req.body.storeId), req.body.targetPrice);
    res.status(201).json(alert);
}));
router.patch('/alerts/:alertId', auth, validate(updatePriceAlertSchema), (async (req, res) => {
    const alert = await priceTrackingService.updatePriceAlert(new ObjectId(req.params.alertId), new ObjectId(req.user.id), req.body);
    if (!alert) {
        res.status(404).json({ error: 'Price alert not found' });
        return;
    }
    res.json(alert);
}));
router.get('/alerts', auth, (async (req, res) => {
    const alerts = await priceTrackingService.getPriceAlerts(new ObjectId(req.user.id));
    res.json(alerts);
}));
router.post('/track', auth, validate(trackPriceSchema), (async (req, res) => {
    await priceTrackingService.trackPrice(new ObjectId(req.body.productId), new ObjectId(req.body.storeId), req.body.price, req.body.currency, req.body.inStock);
    res.status(201).json({ message: 'Price tracked successfully' });
}));
router.get('/history/:productId/:storeId', validate(getPriceHistorySchema, 'query'), (async (req, res) => {
    const history = await priceTrackingService.getPriceHistory(new ObjectId(req.params.productId), new ObjectId(req.params.storeId), req.query.days ? Number(req.query.days) : undefined);
    res.json(history);
}));
router.post('/best-prices', validate(findBestPricesSchema), (async (req, res) => {
    const productIds = req.body.productIds.map((productId) => new ObjectId(productId));
    const bestPrices = await priceTrackingService.findBestPrices(productIds, {
        latitude: req.body.latitude,
        longitude: req.body.longitude,
    }, req.body.maxDistance);
    // Convert Map to a more JSON-friendly format
    const response = Object.fromEntries(bestPrices);
    res.json(response);
}));
export default router;
//# sourceMappingURL=price-tracking.js.map
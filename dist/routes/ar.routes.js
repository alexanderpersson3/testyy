;
import { ObjectId } from 'mongodb';
;
import { z } from 'zod';
import { ARService } from '../services/ar.service.js';
import { authenticate } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';
import logger from '../utils/logger.js';
import { AuthUser } from '../types/auth.js';
const router = Router();
const arService = ARService.getInstance();
// Schema for starting an AR session
const startSessionSchema = z.object({
    recipeId: z.string().optional(),
});
// Schema for adding a measurement
const addMeasurementSchema = z.object({
    sessionId: z.string(),
    type: z.enum(['length', 'volume', 'weight', 'temperature']),
    value: z.number(),
    unit: z.string(),
    confidence: z.number(),
    boundingBox: z.object({
        x: z.number(),
        y: z.number(),
        width: z.number(),
        height: z.number(),
    }),
});
// Schema for camera calibration
const calibrateSchema = z.object({
    deviceId: z.string(),
});
// Schema for updating AR settings
const updateSettingsSchema = z.object({
    preferences: z.object({
        measurementSystem: z.enum(['metric', 'imperial']).optional(),
        overlayOpacity: z.number().min(0).max(1).optional(),
        showMeasurements: z.boolean().optional(),
        showIngredients: z.boolean().optional(),
        showInstructions: z.boolean().optional(),
        showWarnings: z.boolean().optional(),
        autoCalibrate: z.boolean().optional(),
        saveImages: z.boolean().optional(),
    }),
});
// Start AR session
router.post('/sessions', authenticate, validateRequest(startSessionSchema), async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'User not authenticated' });
        }
        const { recipeId } = req.body;
        const session = await arService.startSession(new ObjectId(req.user._id), recipeId ? new ObjectId(recipeId) : undefined);
        res.json(session);
    }
    catch (error) {
        logger.error('Failed to start AR session:', error);
        res.status(500).json({ error: 'Failed to start AR session' });
    }
});
// End AR session
router.post('/sessions/:sessionId/end', authenticate, async (req, res) => {
    try {
        await arService.endSession(new ObjectId(req.params.sessionId));
        res.sendStatus(200);
    }
    catch (error) {
        logger.error('Failed to end AR session:', error);
        res.status(500).json({ error: 'Failed to end AR session' });
    }
});
// Add image to session
router.post('/sessions/:sessionId/images', authenticate, upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No image provided' });
        }
        const overlays = req.body.overlays ? JSON.parse(req.body.overlays) : [];
        await arService.addImage(new ObjectId(req.params.sessionId), req.file.buffer, overlays);
        res.sendStatus(200);
    }
    catch (error) {
        logger.error('Failed to add image to session:', error);
        res.status(500).json({ error: 'Failed to add image to session' });
    }
});
// Add measurement
router.post('/measurements', authenticate, validateRequest(addMeasurementSchema), async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'User not authenticated' });
        }
        const measurement = await arService.addMeasurement({
            userId: new ObjectId(req.user._id),
            sessionId: new ObjectId(req.body.sessionId),
            type: req.body.type,
            value: req.body.value,
            unit: req.body.unit,
            confidence: req.body.confidence,
            boundingBox: req.body.boundingBox,
        });
        res.json(measurement);
    }
    catch (error) {
        logger.error('Failed to add measurement:', error);
        res.status(500).json({ error: 'Failed to add measurement' });
    }
});
// Calibrate camera
router.post('/calibrate', authenticate, upload.single('referenceImage'), validateRequest(calibrateSchema), async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'User not authenticated' });
        }
        if (!req.file) {
            return res.status(400).json({ error: 'No reference image provided' });
        }
        const calibration = await arService.calibrateCamera(new ObjectId(req.user._id), req.body.deviceId, req.file.buffer);
        res.json(calibration);
    }
    catch (error) {
        logger.error('Failed to calibrate camera:', error);
        res.status(500).json({ error: 'Failed to calibrate camera' });
    }
});
// Get AR settings
router.get('/settings', authenticate, async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'User not authenticated' });
        }
        const settings = await arService.getSettings(new ObjectId(req.user._id));
        res.json(settings);
    }
    catch (error) {
        logger.error('Failed to get AR settings:', error);
        res.status(500).json({ error: 'Failed to get AR settings' });
    }
});
// Update AR settings
router.patch('/settings', authenticate, validateRequest(updateSettingsSchema), async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'User not authenticated' });
        }
        const settings = await arService.updateSettings(new ObjectId(req.user._id), req.body.preferences);
        res.json(settings);
    }
    catch (error) {
        logger.error('Failed to update AR settings:', error);
        res.status(500).json({ error: 'Failed to update AR settings' });
    }
});
export default router;
//# sourceMappingURL=ar.routes.js.map
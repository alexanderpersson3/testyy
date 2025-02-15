import express from 'express';
import { z } from 'zod';
import { ObjectId } from 'mongodb';
;
import { auth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { UserProfileService } from '../services/user-profile.service.js';
import multer from 'multer';
import path from 'path';
const router = express.Router();
const profileService = UserProfileService.getInstance();
// Configure multer for avatar uploads
const storage = multer({
    dest: 'uploads/avatars',
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB
    },
    fileFilter: (req, file, callback) => {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
        if (!allowedTypes.includes(file.mimetype)) {
            callback(new Error('Invalid file type. Only JPEG, PNG and WebP are allowed.'), false);
            return;
        }
        callback(null, true);
    },
});
// Validation schemas
const updateProfileSchema = z.object({
    name: z.string().min(2).max(100).optional(),
    bio: z.string().max(500).optional(),
    location: z.string().max(100).optional(),
    website: z.string().url().optional(),
    avatar: z.string().optional(),
    socialLinks: z.object({
        instagram: z.string().optional(),
        twitter: z.string().optional(),
        facebook: z.string().optional(),
    }).optional(),
    preferences: z.object({
        dietary: z.array(z.string()).optional(),
        cuisine: z.array(z.string()).optional(),
        notifications: z.object({
            email: z.boolean(),
            push: z.boolean(),
            inApp: z.boolean(),
        }).optional(),
        privacy: z.object({
            profileVisibility: z.enum(['public', 'private', 'followers']),
            recipeVisibility: z.enum(['public', 'private', 'followers']),
            activityVisibility: z.enum(['public', 'private', 'followers']),
        }).optional(),
    }).optional(),
});
const createCollectionSchema = z.object({
    name: z.string().min(1).max(100),
    description: z.string().max(500).optional(),
    isPrivate: z.boolean().optional(),
});
const gdprConsentSchema = z.object({
    analytics: z.boolean(),
    marketing: z.boolean(),
    thirdParty: z.boolean(),
});
const dataExportSchema = z.object({
    type: z.enum(['profile', 'recipes', 'activity', 'all']),
    format: z.enum(['json', 'csv']),
});
// Routes
router.get('/me', auth, async (req, res, next) => {
    try {
        const profile = await profileService.getProfile(new ObjectId(req.user.id));
        res.json(profile);
    }
    catch (error) {
        next(error);
    }
});
router.get('/:userId', async (req, res, next) => {
    try {
        const profile = await profileService.getProfile(new ObjectId(req.params.userId), req.user ? new ObjectId(req.user.id) : undefined);
        res.json(profile);
    }
    catch (error) {
        next(error);
    }
});
router.patch('/me', auth, validate(updateProfileSchema), async (req, res, next) => {
    try {
        const profile = await profileService.updateProfile(new ObjectId(req.user.id), req.body);
        res.json(profile);
    }
    catch (error) {
        next(error);
    }
});
router.post('/me/avatar', auth, storage.single('avatar'), async (req, res, next) => {
    try {
        if (!req.file) {
            res.status(400).json({ error: 'No file uploaded' });
            return;
        }
        const avatarUrl = `/uploads/avatars/${req.file.filename}`;
        const profile = await profileService.updateProfile(new ObjectId(req.user._id), { avatar: avatarUrl });
        res.json(profile);
    }
    catch (error) {
        next(error);
    }
});
router.post('/follow/:userId', auth, async (req, res, next) => {
    try {
        const response = await profileService.followUser(new ObjectId(req.user.id), new ObjectId(req.params.userId));
        res.json(response);
    }
    catch (error) {
        next(error);
    }
});
router.delete('/follow/:userId', auth, async (req, res, next) => {
    try {
        const response = await profileService.unfollowUser(new ObjectId(req.user.id), new ObjectId(req.params.userId));
        res.json(response);
    }
    catch (error) {
        next(error);
    }
});
router.post('/collections', auth, validate(createCollectionSchema), async (req, res, next) => {
    try {
        const profile = await profileService.createCollection(new ObjectId(req.user.id), req.body);
        res.status(201).json(profile);
    }
    catch (error) {
        next(error);
    }
});
router.put('/gdpr-consent', auth, validate(gdprConsentSchema), async (req, res, next) => {
    try {
        await profileService.updateGDPRConsent(new ObjectId(req.user.id), req.body);
        res.status(204).send();
    }
    catch (error) {
        next(error);
    }
});
router.post('/data-export', auth, validate(dataExportSchema), async (req, res, next) => {
    try {
        await profileService.requestDataExport(new ObjectId(req.user.id), req.body);
        res.status(202).json({
            message: 'Data export request received. You will be notified when it is ready.',
        });
    }
    catch (error) {
        next(error);
    }
});
router.delete('/me', auth, async (req, res, next) => {
    try {
        await profileService.deleteAccount(new ObjectId(req.user.id));
        res.status(204).send();
    }
    catch (error) {
        next(error);
    }
});
export default router;
//# sourceMappingURL=profile.js.map
import express from 'express';
import { z } from 'zod';
import { ObjectId } from 'mongodb';
;
import { auth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { DatabaseService } from '../db/database.service.js';
import { NotFoundError } from '../utils/errors.js';
import { User, UpdateProfileDTO, UserProfile } from '../types/user.js';
const router = express.Router();
const db = DatabaseService.getInstance();
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
// Routes
router.get('/me', auth, (async (req, res) => {
    const user = await db.getCollection('users').findOne({ _id: new ObjectId(req.user.id) }, { projection: { passwordHash: 0 } });
    if (!user) {
        throw new NotFoundError('User not found');
    }
    res.json(user);
}));
router.patch('/me', auth, validate(updateProfileSchema), (async (req, res) => {
    const updateFields = {
        'updatedAt': new Date(),
    };
    // Add optional fields if they exist in the request body
    if (req.body.name)
        updateFields['name'] = req.body.name;
    if (req.body.bio)
        updateFields['bio'] = req.body.bio;
    if (req.body.location)
        updateFields['location'] = req.body.location;
    if (req.body.website)
        updateFields['website'] = req.body.website;
    if (req.body.avatar)
        updateFields['avatar'] = req.body.avatar;
    if (req.body.socialLinks) {
        if (req.body.socialLinks.instagram)
            updateFields['socialLinks.instagram'] = req.body.socialLinks.instagram;
        if (req.body.socialLinks.twitter)
            updateFields['socialLinks.twitter'] = req.body.socialLinks.twitter;
        if (req.body.socialLinks.facebook)
            updateFields['socialLinks.facebook'] = req.body.socialLinks.facebook;
    }
    // Handle preferences updates using dot notation
    if (req.body.preferences) {
        if (req.body.preferences.dietary)
            updateFields['preferences.dietary'] = req.body.preferences.dietary;
        if (req.body.preferences.cuisine)
            updateFields['preferences.cuisine'] = req.body.preferences.cuisine;
        if (req.body.preferences.notifications) {
            if (req.body.preferences.notifications.email !== undefined) {
                updateFields['preferences.notifications.email'] = req.body.preferences.notifications.email;
            }
            if (req.body.preferences.notifications.push !== undefined) {
                updateFields['preferences.notifications.push'] = req.body.preferences.notifications.push;
            }
            if (req.body.preferences.notifications.inApp !== undefined) {
                updateFields['preferences.notifications.inApp'] = req.body.preferences.notifications.inApp;
            }
        }
        if (req.body.preferences.privacy) {
            if (req.body.preferences.privacy.profileVisibility) {
                updateFields['preferences.privacy.profileVisibility'] = req.body.preferences.privacy.profileVisibility;
            }
            if (req.body.preferences.privacy.recipeVisibility) {
                updateFields['preferences.privacy.recipeVisibility'] = req.body.preferences.privacy.recipeVisibility;
            }
            if (req.body.preferences.privacy.activityVisibility) {
                updateFields['preferences.privacy.activityVisibility'] = req.body.preferences.privacy.activityVisibility;
            }
        }
    }
    const result = await db.getCollection('users').findOneAndUpdate({ _id: new ObjectId(req.user.id) }, { $set: updateFields }, { returnDocument: 'after', projection: { passwordHash: 0 } });
    if (!result) {
        throw new NotFoundError('User not found');
    }
    res.json(result);
}));
router.delete('/me', auth, (async (req, res) => {
    const result = await db.getCollection('users').deleteOne({
        _id: new ObjectId(req.user.id),
    });
    if (result.deletedCount === 0) {
        throw new NotFoundError('User not found');
    }
    res.status(204).send();
}));
export default router;
//# sourceMappingURL=user.js.map
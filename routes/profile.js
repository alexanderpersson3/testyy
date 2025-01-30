import express from 'express';
import { z } from 'zod';
import { validateRequest } from '../middleware/validation.js';
const { authenticateToken } = require('../middleware/auth');
import rateLimiter from '../middleware/rate-limit.js';
import profileManager from '../services/profile-manager.js';
import multer from 'multer';

const router = express.Router();
const upload = multer();

// Validation schemas
const updateProfileSchema = z.object({
  displayName: z.string().min(1, 'Display name is required').max(100, 'Display name is too long').optional(),
  username: z.string().min(3, 'Username must be at least 3 characters').max(30, 'Username is too long')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores').optional(),
  bio: z.string().max(500, 'Bio is too long').optional(),
  location: z.string().max(100, 'Location is too long').optional(),
  favoriteCuisine: z.string().max(100, 'Favorite cuisine is too long').optional(),
  socialLinks: z.record(z.string().url('Invalid URL')).optional()
});

const visibilitySchema = z.object({
  isPublic: z.boolean(),
  showSavedRecipes: z.boolean(),
  showLists: z.boolean(),
  showFollowers: z.boolean(),
  showFollowing: z.boolean()
});

// Get user profile
router.get(
  '/me',
  authenticateToken,
  rateLimiter.api(),
  async (req, res) => {
    try {
      const profile = await profileManager.getProfile(req.user.id);

      res.json({
        success: true,
        data: profile
      });
    } catch (error) {
      console.error('Error getting profile:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get profile'
      });
    }
  }
);

// Get public profile by username
router.get(
  '/:username',
  rateLimiter.api(),
  async (req, res) => {
    try {
      const profile = await profileManager.getPublicProfile(req.params.username);

      res.json({
        success: true,
        data: profile
      });
    } catch (error) {
      console.error('Error getting public profile:', error);
      res.status(404).json({
        success: false,
        message: 'Profile not found or is private'
      });
    }
  }
);

// Update profile
router.patch(
  '/me',
  authenticateToken,
  rateLimiter.api(),
  validateRequest({ body: updateProfileSchema }),
  async (req, res) => {
    try {
      const profile = await profileManager.updateProfile(req.user.id, req.body);

      res.json({
        success: true,
        data: profile
      });
    } catch (error) {
      console.error('Error updating profile:', error);
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }
);

// Update profile picture
router.post(
  '/me/picture',
  authenticateToken,
  rateLimiter.api(),
  upload.single('image'),
  async (req, res) => {
    try {
      if (!req.file) {
        throw new Error('No image file provided');
      }

      const profile = await profileManager.updateProfilePicture(
        req.user.id,
        req.file
      );

      res.json({
        success: true,
        data: profile
      });
    } catch (error) {
      console.error('Error updating profile picture:', error);
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }
);

// Update visibility settings
router.patch(
  '/me/visibility',
  authenticateToken,
  rateLimiter.api(),
  validateRequest({ body: visibilitySchema }),
  async (req, res) => {
    try {
      const settings = await profileManager.updateVisibilitySettings(
        req.user.id,
        req.body
      );

      res.json({
        success: true,
        data: settings
      });
    } catch (error) {
      console.error('Error updating visibility settings:', error);
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }
);

// Generate profile share link
router.post(
  '/me/share',
  authenticateToken,
  rateLimiter.api(),
  async (req, res) => {
    try {
      const shareLink = await profileManager.generateShareLink(req.user.id);

      res.json({
        success: true,
        data: { shareLink }
      });
    } catch (error) {
      console.error('Error generating share link:', error);
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }
);

export default router; 
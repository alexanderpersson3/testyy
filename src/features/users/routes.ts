import express, { Request, Response, RequestHandler } from 'express';
import { ObjectId } from 'mongodb';
import { z } from 'zod';
import { databaseService } from '../../core/database/database.service';
import { auth, AuthenticatedRequest } from '../../middleware/auth';
import { validateRequest } from '../../middleware/validate-request';
import { rateLimiter } from '../../middleware/rate-limit';
import { elasticClient } from '../../services/elastic-client';
import { UserRole, DietaryRestriction, CuisineType } from '../../constants';
import { UserService } from './services/user.service';

const router = express.Router();
const userService = new UserService(databaseService);

// Validation schemas
const postalCodeSchema = z.object({
  postalCode: z.string().min(1).max(10)
});

const updateProfileSchema = z.object({
  displayName: z.string().min(2).max(50).optional(),
  bio: z.string().max(500).optional(),
  website: z.string().url().optional().nullable(),
  socialLinks: z.object({
    instagram: z.string().optional(),
    twitter: z.string().optional(),
    facebook: z.string().optional()
  }).optional(),
  preferences: z.object({
    emailNotifications: z.boolean().optional(),
    pushNotifications: z.boolean().optional(),
    privateProfile: z.boolean().optional()
  }).optional()
});

const profileSchema = z.object({
  displayName: z.string().min(2).max(50).optional(),
  bio: z.string().max(500).optional(),
  website: z.string().url().optional().nullable(),
  location: z.string().max(100).optional(),
  avatar: z.string().url().optional(),
  preferences: z.object({
    cuisine: z.array(z.nativeEnum(CuisineType)).optional(),
    dietaryRestrictions: z.array(z.nativeEnum(DietaryRestriction)).optional(),
    cookingLevel: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED']).optional(),
    servingSize: z.number().min(1).max(20).optional(),
    measurementSystem: z.enum(['METRIC', 'IMPERIAL']).optional()
  }).optional()
});

// Get user profile
router.get('/:userId', (async (req: Request, res: Response) => {
  try {
    const userId = new ObjectId(req.params.userId);
    const requestingUserId = req.user?._id;
    
    const userProfile = await userService.getUserProfile(
      userId, 
      requestingUserId ? new ObjectId(requestingUserId) : undefined
    );
    
    if (!userProfile) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(userProfile);
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}) as RequestHandler);

// Update user profile
router.put('/profile', 
  auth.authenticateToken,
  (async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = new ObjectId(req.user._id);
      const validatedData = profileSchema.parse(req.body);

      const updatedProfile = await userService.updateProfile(userId, validatedData);

      // Update in Elasticsearch
      await elasticClient.update({
        index: 'users',
        id: userId.toString(),
        body: {
          doc: {
            ...validatedData,
            updatedAt: new Date()
          }
        }
      });

      if (!updatedProfile) {
        return res.status(404).json({ message: 'User not found' });
      }

      res.json(updatedProfile);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: 'Validation error', 
          errors: error.errors 
        });
      }
      console.error('Error updating profile:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }) as RequestHandler);

// Update user preferences
router.put('/preferences',
  auth.authenticateToken,
  (async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = new ObjectId(req.user._id);
      const preferences = req.body;

      const success = await userService.updatePreferences(userId, preferences);

      res.json({
        success,
        message: success ? 'Preferences updated successfully' : 'Failed to update preferences'
      });
    } catch (error) {
      console.error('Error updating preferences:', error);
      res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : 'Error updating preferences'
      });
    }
  }) as RequestHandler);

// Follow user
router.post('/:userId/follow',
  auth.authenticateToken,
  (async (req: AuthenticatedRequest, res: Response) => {
    try {
      const followerId = new ObjectId(req.user._id);
      const followedId = new ObjectId(req.params.userId);

      if (followerId.equals(followedId)) {
        return res.status(400).json({ message: 'Cannot follow yourself' });
      }

      const result = await userService.toggleFollow(followerId, followedId);

      res.json({ following: result });
    } catch (error) {
      console.error('Error toggling follow:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }) as RequestHandler);

export { router as userRoutes }; 
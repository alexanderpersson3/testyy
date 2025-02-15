import { Router, Request, Response } from 'express';
import { UserService } from '../services/user.service';
import { UserProfileSchema, UserPreferencesSchema } from '../dto/user.dto';
import { authenticateToken } from '../../../middleware/auth';
import { validateRequest } from '../../../middleware/validate-request';
import { rateLimiter } from '../../../middleware/rate-limit';
import { ZodError } from 'zod';

const router = Router();
const userService = UserService.getInstance();

// Get user profile
router.get('/:userId', async (req: Request, res: Response) => {
  try {
    const userId = req.params.userId;
    const currentUserId = req.user?._id;

    const profile = await userService.getUserProfile(userId, currentUserId);
    
    if (!profile) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(profile);
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Update user profile
router.put(
  '/profile',
  authenticateToken,
  rateLimiter,
  async (req: Request, res: Response) => {
    try {
      const userId = req.user!._id;
      const profileData = UserProfileSchema.parse(req.body);

      const updatedProfile = await userService.updateProfile(userId, profileData);
      res.json(updatedProfile);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ 
          message: 'Invalid input data',
          errors: error.errors 
        });
      }
      console.error('Error updating profile:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }
);

// Update user preferences
router.put(
  '/preferences',
  authenticateToken,
  rateLimiter,
  async (req: Request, res: Response) => {
    try {
      const userId = req.user!._id;
      const preferencesData = UserPreferencesSchema.parse(req.body);

      const result = await userService.updatePreferences(userId, preferencesData);
      res.json(result);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ 
          message: 'Invalid input data',
          errors: error.errors 
        });
      }
      console.error('Error updating preferences:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }
);

// Follow/unfollow user
router.post(
  '/:userId/follow',
  authenticateToken,
  rateLimiter,
  async (req: Request, res: Response) => {
    try {
      const followerId = req.user!._id;
      const followedId = req.params.userId;

      const result = await userService.toggleFollow(followerId, followedId);
      res.json(result);
    } catch (error) {
      if (error instanceof Error && error.message === 'Cannot follow yourself') {
        return res.status(400).json({ message: error.message });
      }
      console.error('Error toggling follow status:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }
);

export default router; 
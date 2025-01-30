import express from 'express';
import { z } from 'zod';
import { validateRequest } from '../../middleware/validation.js';
import googleAuthService from '../../services/google-auth.js';
import rateLimiter from '../../middleware/rate-limit.js';

const router = express.Router();

// Validation schemas
const validateGoogleToken = z.object({
  token: z.string().min(1)
});

// Get Google OAuth URL
router.get('/url', (req, res) => {
  try {
    const url = googleAuthService.getAuthUrl();
    res.json({ success: true, url });
  } catch (err) {
    console.error('Error getting Google auth URL:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to generate authentication URL' 
    });
  }
});

// Handle Google OAuth callback
router.get('/callback', async (req, res) => {
  try {
    const { code } = req.query;
    
    if (!code) {
      return res.status(400).json({ 
        success: false, 
        message: 'Authorization code is required' 
      });
    }

    const result = await googleAuthService.handleCallback(code);
    
    res.json({
      success: true,
      ...result
    });
  } catch (err) {
    console.error('Google callback error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to authenticate with Google' 
    });
  }
});

// Verify Google token (for mobile/client-side flow)
router.post(
  '/verify',
  rateLimiter.auth(),
  validateRequest({ body: validateGoogleToken }),
  async (req, res) => {
    try {
      const payload = await googleAuthService.verifyGoogleToken(req.body.token);
      
      if (!payload) {
        return res.status(401).json({ 
          success: false, 
          message: 'Invalid Google token' 
        });
      }

      const googleUser = {
        googleId: payload.sub,
        email: payload.email,
        name: payload.name,
        picture: payload.picture,
        email_verified: payload.email_verified
      };

      const user = await googleAuthService.findOrCreateUser(googleUser);
      const tokens = googleAuthService.generateTokens(user);

      res.json({
        success: true,
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
          picture: user.picture,
          role: user.role
        },
        tokens
      });
    } catch (err) {
      console.error('Google token verification error:', err);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to verify Google token' 
      });
    }
  }
);

export default router; 
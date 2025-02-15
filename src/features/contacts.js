import express from 'express';
import { z } from 'zod';
import { validateRequest } from '../middleware/validation.js';
const { authenticateToken } = require('../middleware/auth');
import contactManager from '../services/contact-manager.js';
import rateLimiter from '../middleware/rate-limit.js';

const router = express.Router();

// Validation schemas
const phoneNumberSchema = z.object({
  phoneNumber: z.string().min(1, 'Phone number is required'),
});

const verifyCodeSchema = z.object({
  phoneNumber: z.string().min(1, 'Phone number is required'),
  code: z.string().length(6, 'Verification code must be 6 digits'),
});

const contactsSchema = z.object({
  contacts: z.array(z.string()).min(1, 'At least one contact is required'),
});

const inviteSchema = z.object({
  phoneNumbers: z.array(z.string()).min(1, 'At least one phone number is required'),
});

// Start phone verification
router.post(
  '/verify/start',
  authenticateToken,
  rateLimiter.phoneVerification(),
  validateRequest({ body: phoneNumberSchema }),
  async (req, res) => {
    try {
      const result = await contactManager.startPhoneVerification(req.user.id, req.body.phoneNumber);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error('Error starting phone verification:', error);
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }
);

// Complete phone verification
router.post(
  '/verify/complete',
  authenticateToken,
  rateLimiter.phoneVerification(),
  validateRequest({ body: verifyCodeSchema }),
  async (req, res) => {
    try {
      const result = await contactManager.verifyPhoneNumber(
        req.user.id,
        req.body.phoneNumber,
        req.body.code
      );

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error('Error completing phone verification:', error);
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }
);

// Find friends by contacts
router.post(
  '/find-friends',
  authenticateToken,
  rateLimiter.api(),
  validateRequest({ body: contactsSchema }),
  async (req, res) => {
    try {
      const result = await contactManager.findFriendsByContacts(req.user.id, req.body.contacts);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error('Error finding friends:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to find friends',
      });
    }
  }
);

// Send invites
router.post(
  '/invite',
  authenticateToken,
  rateLimiter.api(),
  validateRequest({ body: inviteSchema }),
  async (req, res) => {
    try {
      const result = await contactManager.sendInvites(req.user.id, req.body.phoneNumbers);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error('Error sending invites:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to send invites',
      });
    }
  }
);

export default router;

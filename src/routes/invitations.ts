import express, { Request, Response } from 'express';
import { check, validationResult } from 'express-validator';
import { ObjectId } from 'mongodb';

import { auth } from '../middleware/auth.js';
import { connectToDatabase } from '../db/db.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AuthenticatedRequest } from '../types/auth.js';
import { InvitationService } from '../services/invitation.js';
import { sendInvitationEmail } from '../utils/email.js';

const router = express.Router();

// Send invitation
router.post('/',
  auth,
  [
    check('email').isEmail().normalizeEmail(),
    check('name').trim().notEmpty()
  ],
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const db = await connectToDatabase();
    const invitationService = new InvitationService(
      db.collection('invitations'),
      db.collection('users')
    );

    try {
      const invitation = await invitationService.createInvitation(
        new ObjectId(req.user!.id),
        req.body.email,
        req.body.name
      );

      // Send invitation email
      await sendInvitationEmail(invitation);

      res.status(201).json({ invitation });
    } catch (error: any) {
      if (error.message === 'User already registered' || error.message === 'Invitation already sent') {
        return res.status(400).json({ message: error.message });
      }
      throw error;
    }
  })
);

// Get user's sent invitations
router.get('/sent',
  auth,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const db = await connectToDatabase();
    const invitationService = new InvitationService(
      db.collection('invitations'),
      db.collection('users')
    );

    const invitations = await invitationService.getUserInvitations(new ObjectId(req.user!.id));
    res.json({ invitations });
  })
);

// Accept invitation
router.post('/:token/accept',
  [
    check('password').isLength({ min: 8 }),
    check('name').trim().notEmpty()
  ],
  asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const db = await connectToDatabase();
    const invitationService = new InvitationService(
      db.collection('invitations'),
      db.collection('users')
    );

    try {
      const invitation = await invitationService.getInvitation(req.params.token);
      if (!invitation) {
        return res.status(404).json({ message: 'Invalid invitation token' });
      }

      await invitationService.acceptInvitation(req.params.token);

      // Create user account
      const user = {
        email: invitation.email,
        name: req.body.name,
        password: req.body.password, // Note: Hash this password before saving
        role: 'user',
        isVerified: true,
        isPro: false,
        invitedBy: invitation.invitedBy,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await db.collection('users').insertOne(user);

      res.json({ message: 'Invitation accepted successfully' });
    } catch (error: any) {
      if (
        error.message === 'Invalid invitation token' ||
        error.message === 'Invitation is no longer valid' ||
        error.message === 'Invitation has expired'
      ) {
        return res.status(400).json({ message: error.message });
      }
      throw error;
    }
  })
);

// Get invitation details
router.get('/:token',
  asyncHandler(async (req: Request, res: Response) => {
    const db = await connectToDatabase();
    const invitationService = new InvitationService(
      db.collection('invitations'),
      db.collection('users')
    );

    const invitation = await invitationService.getInvitation(req.params.token);
    if (!invitation) {
      return res.status(404).json({ message: 'Invalid invitation token' });
    }

    res.json({ invitation });
  })
);

export default router; 
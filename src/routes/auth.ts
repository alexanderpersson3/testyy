import express, { Response } from 'express';
import { check, validationResult } from 'express-validator';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { ObjectId } from 'mongodb';
import crypto from 'crypto';
import nodemailer from 'nodemailer';

import { rateLimitMiddleware } from '../middleware/rate-limit.js';
import { auth } from '../middleware/auth.js';
import { connectToDatabase } from '../db/db.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { 
  AuthenticatedRequest, 
  LoginRequest, 
  RegisterRequest, 
  TokenPayload,
  UserDocument 
} from '../types/auth.js';
import { sendEmail } from '../services/email.js';
import { InvitationService } from '../services/invitation.js';
import { sendInvitationEmail } from '../utils/email.js';

const router = express.Router();

// Token configuration
const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '7d';

// Rate limiters
const loginLimiter = rateLimitMiddleware.auth();
const registerLimiter = rateLimitMiddleware.auth();
const resetPasswordLimiter = rateLimitMiddleware.custom({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  message: 'Too many password reset attempts, please try again later.'
});
const verifyEmailLimiter = rateLimitMiddleware.custom({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3,
  message: 'Too many email verification attempts, please try again later.'
});

// Logout endpoint
router.post('/logout', auth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const db = await connectToDatabase();
    await db.collection('refreshTokens').deleteMany({
      userId: new ObjectId(req.user?.id)
    });
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error logging out' });
  }
});

// Login endpoint
router.post('/login',
  loginLimiter,
  [
    check('email').isEmail(),
    check('password').exists()
  ],
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body as LoginRequest;
    
    try {
      const db = await connectToDatabase();
      const user = await db.collection<UserDocument>('users').findOne({ email });

      if (!user || !(await bcrypt.compare(password, user.password))) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      const payload: TokenPayload = {
        user: {
          id: user._id.toString(),
          email: user.email,
          role: user.role || 'user'
        }
      };

      const accessToken = jwt.sign(payload, process.env.JWT_SECRET || '', { 
        expiresIn: ACCESS_TOKEN_EXPIRY 
      });

      const refreshToken = jwt.sign(payload, process.env.JWT_REFRESH_SECRET || '', { 
        expiresIn: REFRESH_TOKEN_EXPIRY 
      });

      await db.collection('refreshTokens').insertOne({
        token: refreshToken,
        userId: user._id,
        createdAt: new Date()
      });

      res.json({
        success: true,
        accessToken,
        refreshToken
      });
    } catch (err) {
      res.status(500).json({ message: 'Server error' });
    }
  })
);

// Register new user
router.post('/register',
  registerLimiter,
  [
    check('email').isEmail().normalizeEmail(),
    check('password').isLength({ min: 8 })
      .matches(/^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,}$/)
      .withMessage('Password must be at least 8 characters long and contain both letters and numbers'),
    check('name').notEmpty().trim(),
    check('inviteCode').optional().trim()
  ],
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const db = await connectToDatabase();
    const { email, password, name, inviteCode } = req.body;

    // Check if user already exists
    const existingUser = await db.collection('users').findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'Email already registered' });
    }

    // If invite code provided, verify it
    if (inviteCode) {
      const invitation = await db.collection('invitations').findOne({
        code: inviteCode,
        status: 'pending',
        expiresAt: { $gt: new Date() }
      });

      if (!invitation) {
        return res.status(400).json({ message: 'Invalid or expired invitation code' });
      }
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user
    const user = {
      email,
      password: hashedPassword,
      name,
      role: inviteCode ? 'user' : 'limited',
      createdAt: new Date(),
      updatedAt: new Date(),
      settings: {
        emailNotifications: true,
        theme: 'light',
        language: 'en'
      }
    };

    const result = await db.collection('users').insertOne(user);

    // If invite code was used, mark it as used
    if (inviteCode) {
      await db.collection('invitations').updateOne(
        { code: inviteCode },
        {
          $set: {
            status: 'used',
            usedBy: result.insertedId,
            usedAt: new Date()
          }
        }
      );

      // Add user to any shared collections they were invited to
      await db.collection('recipe_collections').updateMany(
        { 'pendingInvites.email': email },
        {
          $push: {
            'collaborators': {
              $each: [{
                userId: result.insertedId,
                role: 'viewer',
                addedAt: new Date()
              }]
            }
          } as any,
          $pull: {
            'pendingInvites': {
              email
            }
          } as any
        }
      );
    }

    // Generate JWT
    const token = jwt.sign(
      { id: result.insertedId },
      process.env.JWT_SECRET!,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      token,
      user: {
        id: result.insertedId,
        email,
        name,
        role: user.role
      }
    });
  })
);

// Register new user
router.post('/signup',
  [
    check('email').isEmail().normalizeEmail(),
    check('password').isLength({ min: 8 }),
    check('name').trim().notEmpty(),
    check('invites').optional().isArray(),
    check('invites.*.email').optional().isEmail().normalizeEmail(),
    check('invites.*.name').optional().trim().notEmpty()
  ],
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const db = await connectToDatabase();
    const { email, password, name, invites } = req.body;

    // Check if user already exists
    const existingUser = await db.collection('users').findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user
    const user = {
      email,
      password: hashedPassword,
      name,
      role: 'user',
      isVerified: false,
      isPro: false,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await db.collection('users').insertOne(user);
    const userId = result.insertedId;

    // Send invitations if provided
    if (invites && invites.length > 0) {
      const invitationService = new InvitationService(
        db.collection('invitations'),
        db.collection('users')
      );

      const invitationPromises = invites.map(async (invite: { email: string; name: string }) => {
        try {
          const invitation = await invitationService.createInvitation(
            userId,
            invite.email,
            invite.name
          );
          await sendInvitationEmail(invitation);
          return invitation;
        } catch (error) {
          console.error(`Failed to send invitation to ${invite.email}:`, error);
          return null;
        }
      });

      await Promise.all(invitationPromises);
    }

    // Generate JWT
    const token = jwt.sign(
      { id: userId },
      process.env.JWT_SECRET!,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      token,
      user: {
        id: userId,
        email,
        name,
        role: user.role,
        isVerified: user.isVerified,
        isPro: user.isPro
      }
    });
  })
);

// Accept invitation
router.post('/accept-invite',
  [
    check('token').notEmpty(),
    check('password').isLength({ min: 6 }),
    check('name').optional().trim()
  ],
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const db = await connectToDatabase();
    const { token, password, name } = req.body;

    // Find invitation
    const invitation = await db.collection('invitations').findOne({
      token,
      status: 'pending'
    });

    if (!invitation) {
      return res.status(404).json({ message: 'Invalid or expired invitation' });
    }

    // Check if user already exists
    const existingUser = await db.collection('users').findOne({
      email: invitation.email
    });

    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user
    const user = {
      email: invitation.email,
      password: hashedPassword,
      name: name || invitation.name,
      invitedBy: invitation.inviterId,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await db.collection('users').insertOne(user);

    // Update invitation status
    await db.collection('invitations').updateOne(
      { _id: invitation._id },
      {
        $set: {
          status: 'accepted',
          acceptedAt: new Date()
        }
      }
    );

    // Create token
    const jwtToken = jwt.sign(
      { id: result.insertedId },
      process.env.JWT_SECRET!,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      token: jwtToken,
      user: {
        id: result.insertedId,
        email: invitation.email,
        name: name || invitation.name
      }
    });
  })
);

// Create invitation
router.post('/invite',
  auth,
  [
    check('email').isEmail().normalizeEmail(),
    check('role').optional().isIn(['user', 'editor']),
    check('message').optional().trim()
  ],
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const db = await connectToDatabase();
    const inviterId = new ObjectId(req.user!.id);

    // Check if inviter has permission
    const inviter = await db.collection('users').findOne({ _id: inviterId });
    if (!inviter || !['admin', 'editor'].includes(inviter.role)) {
      return res.status(403).json({ message: 'Not authorized to send invitations' });
    }

    // Generate unique invitation code
    const code = Math.random().toString(36).substring(2, 15) + 
                Math.random().toString(36).substring(2, 15);

    // Create invitation
    const invitation = {
      code,
      email: req.body.email,
      role: req.body.role || 'user',
      message: req.body.message,
      inviterId,
      status: 'pending',
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    };

    await db.collection('invitations').insertOne(invitation);

    // Send invitation email
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT!),
      secure: true,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });

    const inviteUrl = `${process.env.APP_URL}/register?invite=${code}`;
    await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to: req.body.email,
      subject: `You've been invited to join Rezepta`,
      html: `
        <h1>Welcome to Rezepta!</h1>
        <p>${inviter.name} has invited you to join Rezepta.</p>
        ${req.body.message ? `<p>Message: ${req.body.message}</p>` : ''}
        <p>Click the link below to create your account:</p>
        <a href="${inviteUrl}">${inviteUrl}</a>
        <p>This invitation will expire in 7 days.</p>
      `
    });

    res.json({ success: true });
  })
);

// Get invitation details
router.get('/invite/:code',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const db = await connectToDatabase();
    const { code } = req.params;

    const invitation = await db.collection('invitations').findOne({
      code,
      status: 'pending',
      expiresAt: { $gt: new Date() }
    });

    if (!invitation) {
      return res.status(404).json({ message: 'Invalid or expired invitation code' });
    }

    const inviter = await db.collection('users').findOne(
      { _id: invitation.inviterId },
      { projection: { name: 1, email: 1 } }
    );

    res.json({
      invitation: {
        email: invitation.email,
        role: invitation.role,
        message: invitation.message,
        expiresAt: invitation.expiresAt,
        inviter: {
          name: inviter?.name,
          email: inviter?.email
        }
      }
    });
  })
);

// Reset password request
router.post('/reset-password',
  resetPasswordLimiter,
  [
    check('email').isEmail().normalizeEmail()
  ],
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const db = await connectToDatabase();
    const { email } = req.body;

    const user = await db.collection('users').findOne({ email });
    if (!user) {
      // Don't reveal if email exists
      return res.json({ success: true });
    }

    // Generate reset token
    const resetToken = Math.random().toString(36).substring(2, 15) +
                      Math.random().toString(36).substring(2, 15);
    const resetExpires = new Date(Date.now() + 1 * 60 * 60 * 1000); // 1 hour

    await db.collection('users').updateOne(
      { _id: user._id },
      {
        $set: {
          resetPasswordToken: resetToken,
          resetPasswordExpires: resetExpires
        }
      }
    );

    // Send reset email
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT!),
      secure: true,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });

    const resetUrl = `${process.env.APP_URL}/reset-password?token=${resetToken}`;
    await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to: email,
      subject: 'Reset Your Rezepta Password',
      html: `
        <h1>Reset Your Password</h1>
        <p>Click the link below to reset your password:</p>
        <a href="${resetUrl}">${resetUrl}</a>
        <p>This link will expire in 1 hour.</p>
        <p>If you didn't request this, please ignore this email.</p>
      `
    });

    res.json({ success: true });
  })
);

// Reset password with token
router.post('/reset-password/:token',
  [
    check('password').isLength({ min: 8 })
      .matches(/^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,}$/)
      .withMessage('Password must be at least 8 characters long and contain both letters and numbers')
  ],
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const db = await connectToDatabase();
    const { token } = req.params;
    const { password } = req.body;

    const user = await db.collection('users').findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: new Date() }
    });

    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired reset token' });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    await db.collection('users').updateOne(
      { _id: user._id },
      {
        $set: {
          password: hashedPassword,
          updatedAt: new Date()
        },
        $unset: {
          resetPasswordToken: '',
          resetPasswordExpires: ''
        }
      }
    );

    res.json({ success: true });
  })
);

export default router; 
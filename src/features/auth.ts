import express, { Request, Response } from 'express';
import { check, validationResult } from 'express-validator';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import rateLimitMiddleware from '../middleware/rate-limit';
import { auth } from '../middleware/auth';
import { db } from '../db';
import { ObjectId } from 'mongodb';
import { asyncHandler } from '../utils/asyncHandler';
import { z } from 'zod';
import crypto from 'crypto';

const router = express.Router();

// Token configuration
const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '7d';

// Validation schemas
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  username: z.string().min(3),
  displayName: z.string().optional(),
});

const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

const resetPasswordSchema = z.object({
  email: z.string().email(),
});

const confirmResetSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

const verifyEmailSchema = z.object({
  token: z.string().min(1, 'Verification token is required'),
});

interface AuthRequest extends Request {
  user?: { id: string; email: string; role: string };
}

const VERIFICATION_TOKEN_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours

// Logout endpoint
router.post('/logout', auth, asyncHandler(async (req: AuthRequest, res: Response) => {
  try {
    await db.getDb().then(db => db.collection('refreshTokens').deleteMany({
      userId: new ObjectId((req as any).user.id),
    }));
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error logging out' });
  }
}));

// Login endpoint
router.post(
  '/login',
  rateLimitMiddleware.auth,
  ...[check('email').isEmail(), check('password').exists()],
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { email, password } = loginSchema.parse(req.body);

      const user = await db.getDb().then(db =>
        db.collection('users').findOne({ email: email.toLowerCase() })
      );

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Invalid credentials',
        });
      }

      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(401).json({
          success: false,
          message: 'Invalid credentials',
        });
      }

      const accessToken = jwt.sign(
        { id: user._id, email: user.email, role: user.role },
        process.env.JWT_SECRET as string,
        { expiresIn: ACCESS_TOKEN_EXPIRY }
      );

      const refreshToken = jwt.sign(
        { id: user._id },
        process.env.JWT_REFRESH_SECRET as string,
        { expiresIn: REFRESH_TOKEN_EXPIRY }
      );

      await db.getDb().then(db =>
        db.collection('refreshTokens').insertOne({
          token: refreshToken,
          userId: new ObjectId(user._id),
          createdAt: new Date(),
        })
      );

      res.json({
        success: true,
        accessToken,
        refreshToken,
        user: {
          id: user._id,
          email: user.email,
          username: user.username,
          displayName: user.displayName,
          role: user.role,
        },
      });
    } catch (err) {
      res.status(500).json({ success: false, message: 'Login failed' });
    }
  })
);

// Registration endpoint
router.post(
  '/register',
  rateLimitMiddleware.auth,
  [check('email').isEmail(), check('password').isLength({ min: 6 })],
  asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const data = registerSchema.parse(req.body);
      const { email, password, username, displayName } = data;

      const existingUser = await db.getDb().then(db =>
        db.collection('users').findOne({
          $or: [{ email: email.toLowerCase() }, { username }],
        })
      );

      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'User already exists',
        });
      }

      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      const user = await db.getDb().then(db =>
        db.collection('users').insertOne({
          email: email.toLowerCase(),
          password: hashedPassword,
          username,
          displayName: displayName || username,
          role: 'USER',
          verified: false,
          createdAt: new Date(),
        })
      );

      // Create verification token
      const verificationToken = crypto.randomBytes(32).toString('hex');
      await db.getDb().then(db => db.collection('verificationTokens').insertOne({
        userId: user.insertedId,
        token: verificationToken,
        type: 'EMAIL_VERIFICATION',
        expiresAt: new Date(Date.now() + VERIFICATION_TOKEN_EXPIRY),
        createdAt: new Date(),
      }));

      // TODO: Send verification email
      // await emailService.sendVerificationEmail(email, verificationToken);

      res.status(201).json({
        success: true,
        message: 'User registered successfully. Please check your email to verify your account.',
        userId: user.insertedId,
      });
    } catch (err) {
      res.status(500).json({ success: false, message: 'Registration failed' });
    }
  })
);

// Refresh token endpoint
router.post('/refresh-token', 
  rateLimitMiddleware.auth,
  asyncHandler(async (req: Request, res: Response) => {
    let parsedToken: string;

    try {
      const { refreshToken } = refreshTokenSchema.parse(req.body);
      parsedToken = refreshToken;
    } catch (err) {
      return res.status(400).json({ success: false, message: 'Invalid request body' });
    }

    try {
      const decoded = jwt.verify(parsedToken, process.env.JWT_REFRESH_SECRET as string) as { id: string };
      
      const tokenDoc = await db.getDb().then(db =>
        db.collection('refreshTokens').findOne({
          token: parsedToken,
          userId: new ObjectId(decoded.id),
        })
      );

      if (!tokenDoc) {
        return res.status(401).json({ success: false, message: 'Invalid refresh token' });
      }

      const user = await db.getDb().then(db =>
        db.collection('users').findOne({ _id: new ObjectId(decoded.id) })
      );

      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      const accessToken = jwt.sign(
        { id: user._id, email: user.email, role: user.role },
        process.env.JWT_SECRET as string,
        { expiresIn: ACCESS_TOKEN_EXPIRY }
      );

      const newRefreshToken = jwt.sign(
        { id: user._id },
        process.env.JWT_REFRESH_SECRET as string,
        { expiresIn: REFRESH_TOKEN_EXPIRY }
      );

      await db.getDb().then(db => db.collection('refreshTokens').updateOne(
        { token: parsedToken },
        { $set: { token: newRefreshToken, updatedAt: new Date() } }
      ));

      res.json({ success: true, accessToken, refreshToken: newRefreshToken });
    } catch (err) {
      console.error('Error refreshing token:', err);
      res.status(401).json({ success: false, message: 'Invalid refresh token' });
    }
  })
);

// Request password reset
router.post('/forgot-password',
  rateLimitMiddleware.auth,
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const { email } = resetPasswordSchema.parse(req.body);
      
      const user = await db.getDb().then(db =>
        db.collection('users').findOne({ email: email.toLowerCase() })
      );

      if (!user) {
        return res.json({ success: true, message: 'If the email exists, a reset link will be sent' });
      }

      const resetToken = crypto.randomBytes(32).toString('hex');
      await db.getDb().then(db => db.collection('verificationTokens').insertOne({
        userId: user._id,
        token: resetToken,
        type: 'PASSWORD_RESET',
        expiresAt: new Date(Date.now() + VERIFICATION_TOKEN_EXPIRY),
        createdAt: new Date(),
      }));

      // TODO: Send password reset email
      // await emailService.sendPasswordResetEmail(email, resetToken);

      res.json({ success: true, message: 'If the email exists, a reset link will be sent' });
    } catch (err) {
      res.status(400).json({ success: false, message: 'Invalid request' });
    }
  })
);

// Reset password
router.post('/reset-password',
  rateLimitMiddleware.auth,
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const { token, password } = confirmResetSchema.parse(req.body);

      const resetToken = await db.getDb().then(db =>
        db.collection('verificationTokens').findOne({
          token,
          type: 'PASSWORD_RESET',
          expiresAt: { $gt: new Date() },
        })
      );

      if (!resetToken) {
        return res.status(400).json({ success: false, message: 'Invalid or expired reset token' });
      }

      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      await db.getDb().then(db =>
        db.collection('users').updateOne(
          { _id: resetToken.userId },
          { $set: { password: hashedPassword } }
        )
      );

      await db.getDb().then(db =>
        db.collection('verificationTokens').deleteOne({ _id: resetToken._id })
      );

      res.json({ success: true, message: 'Password reset successfully' });
    } catch (err) {
      res.status(400).json({ success: false, message: 'Invalid request' });
    }
  })
);

// Verify email
router.post('/verify-email',
  rateLimitMiddleware.auth,
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const { token } = verifyEmailSchema.parse(req.body);

      const verificationToken = await db.getDb().then(db =>
        db.collection('verificationTokens').findOne({
          token,
          type: 'EMAIL_VERIFICATION',
          expiresAt: { $gt: new Date() },
        })
      );

      if (!verificationToken) {
        return res.status(400).json({ success: false, message: 'Invalid or expired verification token' });
      }

      await db.getDb().then(db =>
        db.collection('users').updateOne(
          { _id: verificationToken.userId },
          { $set: { verified: true } }
        )
      );

      await db.getDb().then(db =>
        db.collection('verificationTokens').deleteOne({ _id: verificationToken._id })
      );

      res.json({ success: true, message: 'Email verified successfully' });
    } catch (err) {
      res.status(400).json({ success: false, message: 'Invalid request' });
    }
  })
);

// Resend verification email
router.post('/resend-verification',
  rateLimitMiddleware.auth,
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const { email } = resetPasswordSchema.parse(req.body);
      
      const user = await db.getDb().then(db =>
        db.collection('users').findOne({ 
          email: email.toLowerCase(),
          verified: false,
        })
      );

      if (!user) {
        return res.json({ 
          success: true, 
          message: 'If an unverified account exists with this email, a verification link will be sent' 
        });
      }

      await db.getDb().then(db =>
        db.collection('verificationTokens').deleteMany({
          userId: user._id,
          type: 'EMAIL_VERIFICATION'
        })
      );

      const verificationToken = crypto.randomBytes(32).toString('hex');
      await db.getDb().then(db => db.collection('verificationTokens').insertOne({
        userId: user._id,
        token: verificationToken,
        type: 'EMAIL_VERIFICATION',
        expiresAt: new Date(Date.now() + VERIFICATION_TOKEN_EXPIRY),
        createdAt: new Date(),
      }));

      // TODO: Send verification email
      // await emailService.sendVerificationEmail(email, verificationToken);

      res.json({
        success: true,
        message: 'If an unverified account exists with this email, a verification link will be sent'
      });
    } catch (err) {
      res.status(400).json({ success: false, message: 'Invalid request' });
    }
  })
);

export default router;
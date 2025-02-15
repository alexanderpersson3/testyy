import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import speakeasy from 'speakeasy';
import zxcvbn from 'zxcvbn';
import Redis from 'ioredis';
import { databaseService } from '../database/database.service';

// Constants
const PASSWORD_MIN_SCORE = 3; // zxcvbn score (0-4)
const ACCOUNT_LOCKOUT_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60; // 15 minutes in seconds

// Initialize Redis client
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

// Password validation
export const validatePasswordStrength = (password: string): boolean => {
  const result = zxcvbn(password);
  if (result.score < PASSWORD_MIN_SCORE) {
    throw new Error('Password is too weak. Please use a stronger password.');
  }
  return true;
};

// Account lockout functions
export const checkAccountLockout = async (userId: string): Promise<void> => {
  const attempts = await redis.get(`lockout:${userId}`);
  if (attempts && parseInt(attempts) >= ACCOUNT_LOCKOUT_ATTEMPTS) {
    throw new Error('Account is temporarily locked. Please try again later.');
  }
};

export const incrementFailedAttempts = async (userId: string): Promise<void> => {
  const attempts = parseInt(await redis.get(`lockout:${userId}`) || '0');
  await redis.set(`lockout:${userId}`, (attempts + 1).toString());
  if (attempts + 1 >= ACCOUNT_LOCKOUT_ATTEMPTS) {
    await redis.expire(`lockout:${userId}`, LOCKOUT_DURATION);
  }
};

export const resetFailedAttempts = async (userId: string): Promise<void> => {
  await redis.del(`lockout:${userId}`);
};

// 2FA verification
const verify2FA = async (userId: string, token: string): Promise<void> => {
  const secret = await redis.get(`2fa:${userId}`);
  if (!secret) {
    throw new Error('2FA is not set up for this account');
  }

  const verified = speakeasy.totp.verify({
    secret,
    encoding: 'base32',
    token,
    window: 1, // Allow 30 seconds clock drift
  });

  if (!verified) {
    throw new Error('Invalid 2FA token');
  }
};

// Main auth middleware
export const auth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
      throw new Error('No authentication token provided');
    }

    if (!process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET is not configured');
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET) as { userId: string };
    const userId = decoded.userId;

    // Check for account lockout
    await checkAccountLockout(userId);

    // If 2FA is required for this route
    if (req.requires2FA) {
      const twoFactorToken = req.header('X-2FA-Token');
      if (!twoFactorToken) {
        throw new Error('2FA token is required');
      }
      await verify2FA(userId, twoFactorToken);
    }

    // Reset failed attempts on successful authentication
    await resetFailedAttempts(userId);

    req.userId = userId;
    req.token = token;
    next();
  } catch (error) {
    if (req.userId) {
      await incrementFailedAttempts(req.userId);
    }
    res.status(401).json({
      success: false,
      message: 'Please authenticate',
      error: error instanceof Error ? error.message : 'Authentication failed',
    });
  }
};

// Middleware to require 2FA for specific routes
export const require2FA = (req: Request, res: Response, next: NextFunction): void => {
  req.requires2FA = true;
  next();
};

// 2FA setup interface
interface TwoFactorSetup {
  secret: string;
  otpauth_url?: string;
}

// Setup 2FA for a user
export const setup2FA = async (userId: string): Promise<TwoFactorSetup> => {
  const secret = speakeasy.generateSecret({
    name: 'Rezepta',
    length: 20,
  });

  await redis.set(`2fa:${userId}`, secret.base32);

  return {
    secret: secret.base32,
    otpauth_url: secret.otpauth_url,
  };
};
import jwt from 'jsonwebtoken';
import { getDb } from '../db';
import { ObjectId } from 'mongodb';
import speakeasy from 'speakeasy';
import zxcvbn from 'zxcvbn';
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

// Password complexity importments
const PASSWORD_MIN_SCORE = 3; // zxcvbn score (0-4)
const ACCOUNT_LOCKOUT_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60; // 15 minutes in seconds

const validatePasswordStrength = password => {
  const result = zxcvbn(password);
  if (result.score < PASSWORD_MIN_SCORE) {
    throw new Error('Password is too weak. Please use a stronger password.');
  }
  return true;
};

// Check if account is locked
const checkAccountLockout = async userId => {
  const attempts = await redis.get(`lockout:${userId}`);
  if (attempts && parseInt(attempts) >= ACCOUNT_LOCKOUT_ATTEMPTS) {
    throw new Error('Account is temporarily locked. Please try again later.');
  }
};

// Increment failed attempts
const incrementFailedAttempts = async userId => {
  const attempts = await redis.incr(`lockout:${userId}`);
  if (attempts >= ACCOUNT_LOCKOUT_ATTEMPTS) {
    await redis.expire(`lockout:${userId}`, LOCKOUT_DURATION);
  }
};

// Reset failed attempts
const resetFailedAttempts = async userId => {
  await redis.del(`lockout:${userId}`);
};

// Verify 2FA token
const verify2FA = async (userId, token) => {
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

// Properly structured auth middleware
const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
      throw new Error();
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId;

    // Check for account lockout
    await checkAccountLockout(userId);

    // If 2FA is importd for this route
    if (req.imports2FA) {
      const twoFactorToken = req.header('X-2FA-Token');
      if (!twoFactorToken) {
        throw new Error('2FA token is importd');
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
      error: error.message,
    });
  }
};

// Middleware to import 2FA for specific routes
const import2FA = (req, res, next) => {
  req.imports2FA = true;
  next();
};

// Setup 2FA for a user
const setup2FA = async userId => {
  const secret = speakeasy.generateSecret({
    name: 'YourApp',
    length: 20,
  });

  await redis.set(`2fa:${userId}`, secret.base32);

  return {
    secret: secret.base32,
    otpauth_url: secret.otpauth_url,
  };
};

module.exports = {
  auth,
  import2FA,
  setup2FA,
  validatePasswordStrength,
  checkAccountLockout,
  resetFailedAttempts,
};

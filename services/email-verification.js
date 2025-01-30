const { getDb } = require('../db');
const { ObjectId } = require('mongodb');
const crypto = require('crypto');
const auditLogger = require('./audit-logger');
const { sendEmail } = require('./email');

class EmailVerificationManager {
  constructor() {
    this.TOKEN_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours
  }

  async generateVerificationToken(userId, email) {
    try {
      const db = getDb();
      
      // Generate a secure random token
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + this.TOKEN_EXPIRY);

      // Store the verification token
      await db.collection('email_verification_tokens').insertOne({
        userId: new ObjectId(userId),
        email,
        token,
        expiresAt,
        used: false
      });

      // Send verification email
      await sendEmail({
        to: email,
        subject: 'Verify Your Email Address',
        template: 'email-verification',
        data: {
          verificationLink: `${process.env.FRONTEND_URL}/verify-email?token=${token}`
        }
      });

      await auditLogger.log(
        auditLogger.eventTypes.USER.EMAIL_VERIFICATION_REQUEST,
        { userId, email },
        { severity: auditLogger.severityLevels.INFO }
      );

      return true;
    } catch (err) {
      console.error('Error generating verification token:', err);
      throw err;
    }
  }

  async verifyEmail(token) {
    try {
      const db = getDb();
      
      // Find and validate token
      const verificationToken = await db.collection('email_verification_tokens').findOne({
        token,
        used: false,
        expiresAt: { $gt: new Date() }
      });

      if (!verificationToken) {
        throw new Error('Invalid or expired verification token');
      }

      // Update user's email verification status
      await db.collection('users').updateOne(
        { _id: verificationToken.userId },
        { 
          $set: { 
            isEmailVerified: true,
            email: verificationToken.email,
            updatedAt: new Date()
          }
        }
      );

      // Mark token as used
      await db.collection('email_verification_tokens').updateOne(
        { _id: verificationToken._id },
        { $set: { used: true } }
      );

      await auditLogger.log(
        auditLogger.eventTypes.USER.EMAIL_VERIFIED,
        { userId: verificationToken.userId, email: verificationToken.email },
        { severity: auditLogger.severityLevels.INFO }
      );

      return true;
    } catch (err) {
      console.error('Error verifying email:', err);
      throw err;
    }
  }

  async resendVerification(userId) {
    try {
      const db = getDb();
      
      // Get user
      const user = await db.collection('users').findOne({ 
        _id: new ObjectId(userId)
      });
      
      if (!user) {
        throw new Error('User not found');
      }

      if (user.isEmailVerified) {
        throw new Error('Email is already verified');
      }

      // Generate new verification token
      await this.generateVerificationToken(userId, user.email);

      return true;
    } catch (err) {
      console.error('Error resending verification:', err);
      throw err;
    }
  }

  async cleanupExpiredTokens() {
    try {
      const db = getDb();
      await db.collection('email_verification_tokens').deleteMany({
        $or: [
          { expiresAt: { $lt: new Date() } },
          { used: true }
        ]
      });
    } catch (err) {
      console.error('Error cleaning up expired tokens:', err);
      throw err;
    }
  }

  async updateEmail(userId, newEmail, password) {
    try {
      const db = getDb();
      
      // Get user
      const user = await db.collection('users').findOne({ 
        _id: new ObjectId(userId)
      });
      
      if (!user) {
        throw new Error('User not found');
      }

      // Check if email is already in use
      const existingUser = await db.collection('users').findOne({ 
        email: newEmail,
        _id: { $ne: user._id }
      });

      if (existingUser) {
        throw new Error('Email is already in use');
      }

      // Verify password
      const bcrypt = require('bcryptjs');
      const isValid = await bcrypt.compare(password, user.password);
      if (!isValid) {
        throw new Error('Invalid password');
      }

      // Generate verification token for new email
      await this.generateVerificationToken(userId, newEmail);

      return true;
    } catch (err) {
      console.error('Error updating email:', err);
      throw err;
    }
  }
}

module.exports = new EmailVerificationManager(); 
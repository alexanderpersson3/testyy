const { getDb } = require('../db');
const { ObjectId } = require('mongodb');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const auditLogger = require('./audit-logger');
const { sendEmail } = require('./email');

class PasswordResetManager {
  constructor() {
    this.TOKEN_EXPIRY = 30 * 60 * 1000; // 30 minutes
    this.SALT_ROUNDS = 10;
  }

  async generateResetToken(email) {
    try {
      const db = getDb();
      const user = await db.collection('users').findOne({ email });
      
      if (!user) {
        throw new Error('No account found with this email');
      }

      // Generate a secure random token
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + this.TOKEN_EXPIRY);

      // Store the reset token
      await db.collection('password_reset_tokens').insertOne({
        userId: user._id,
        token,
        expiresAt,
        used: false
      });

      // Send reset email
      await sendEmail({
        to: email,
        subject: 'Password Reset Request',
        template: 'password-reset',
        data: {
          resetLink: `${process.env.FRONTEND_URL}/reset-password?token=${token}`
        }
      });

      await auditLogger.log(
        auditLogger.eventTypes.USER.PASSWORD_RESET_REQUEST,
        { userId: user._id },
        { severity: auditLogger.severityLevels.INFO }
      );

      return true;
    } catch (err) {
      console.error('Error generating reset token:', err);
      throw err;
    }
  }

  async resetPassword(token, newPassword) {
    try {
      const db = getDb();
      
      // Find and validate token
      const resetToken = await db.collection('password_reset_tokens').findOne({
        token,
        used: false,
        expiresAt: { $gt: new Date() }
      });

      if (!resetToken) {
        throw new Error('Invalid or expired reset token');
      }

      // Hash the new password
      const hashedPassword = await bcrypt.hash(newPassword, this.SALT_ROUNDS);

      // Update user's password
      await db.collection('users').updateOne(
        { _id: resetToken.userId },
        { 
          $set: { 
            password: hashedPassword,
            updatedAt: new Date()
          }
        }
      );

      // Mark token as used
      await db.collection('password_reset_tokens').updateOne(
        { _id: resetToken._id },
        { $set: { used: true } }
      );

      await auditLogger.log(
        auditLogger.eventTypes.USER.PASSWORD_RESET_COMPLETE,
        { userId: resetToken.userId },
        { severity: auditLogger.severityLevels.INFO }
      );

      return true;
    } catch (err) {
      console.error('Error resetting password:', err);
      throw err;
    }
  }

  async changePassword(userId, currentPassword, newPassword) {
    try {
      const db = getDb();
      
      // Get user
      const user = await db.collection('users').findOne({ _id: new ObjectId(userId) });
      
      if (!user) {
        throw new Error('User not found');
      }

      // Verify current password
      const isValid = await bcrypt.compare(currentPassword, user.password);
      if (!isValid) {
        throw new Error('Current password is incorrect');
      }

      // Hash and update new password
      const hashedPassword = await bcrypt.hash(newPassword, this.SALT_ROUNDS);
      
      await db.collection('users').updateOne(
        { _id: user._id },
        { 
          $set: { 
            password: hashedPassword,
            updatedAt: new Date()
          }
        }
      );

      await auditLogger.log(
        auditLogger.eventTypes.USER.PASSWORD_CHANGE,
        { userId },
        { severity: auditLogger.severityLevels.INFO }
      );

      return true;
    } catch (err) {
      console.error('Error changing password:', err);
      throw err;
    }
  }

  async cleanupExpiredTokens() {
    try {
      const db = getDb();
      await db.collection('password_reset_tokens').deleteMany({
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
}

module.exports = new PasswordResetManager(); 
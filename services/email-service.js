import nodemailer from 'nodemailer';
import jwt from 'jsonwebtoken';
import { getDb } from '../config/db.js';
import { ObjectId } from 'mongodb';

class EmailService {
  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
  }

  async sendPasswordResetEmail(email, token) {
    const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;
    
    await this.transporter.sendMail({
      from: process.env.SMTP_FROM,
      to: email,
      subject: 'Reset Your Password - Rezepta',
      html: `
        <h1>Password Reset Request</h1>
        <p>Click the link below to reset your password:</p>
        <a href="${resetLink}">Reset Password</a>
        <p>This link will expire in 24 hours.</p>
        <p>If you didn't request this, please ignore this email.</p>
      `
    });
  }

  async sendVerificationEmail(email, token) {
    const verifyLink = `${process.env.FRONTEND_URL}/verify-email?token=${token}`;
    
    await this.transporter.sendMail({
      from: process.env.SMTP_FROM,
      to: email,
      subject: 'Verify Your Email - Rezepta',
      html: `
        <h1>Welcome to Rezepta!</h1>
        <p>Please verify your email address by clicking the link below:</p>
        <a href="${verifyLink}">Verify Email</a>
        <p>This link will expire in 24 hours.</p>
      `
    });
  }

  generateToken(data, expiresIn = '24h') {
    return jwt.sign(
      data,
      process.env.JWT_SECRET,
      { expiresIn }
    );
  }

  verifyToken(token) {
    try {
      return jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      return null;
    }
  }

  async initiatePasswordReset(email) {
    const db = await getDb();
    const user = await db.collection('users').findOne({ email });
    
    if (!user) {
      // Still return success to prevent email enumeration
      return true;
    }

    const token = this.generateToken({ 
      userId: user._id.toString(),
      type: 'password_reset'
    });

    await this.sendPasswordResetEmail(email, token);
    return true;
  }

  async completePasswordReset(token, newPassword) {
    const payload = this.verifyToken(token);
    if (!payload || payload.type !== 'password_reset') {
      throw new Error('Invalid or expired token');
    }

    const db = await getDb();
    const result = await db.collection('users').updateOne(
      { _id: new ObjectId(payload.userId) },
      { 
        $set: { 
          password: newPassword, // Note: Password should be hashed before this point
          updated_at: new Date()
        }
      }
    );

    return result.modifiedCount > 0;
  }

  async sendVerification(userId, email) {
    const token = this.generateToken({
      userId,
      type: 'email_verification'
    });

    await this.sendVerificationEmail(email, token);
    return true;
  }

  async verifyEmail(token) {
    const payload = this.verifyToken(token);
    if (!payload || payload.type !== 'email_verification') {
      throw new Error('Invalid or expired token');
    }

    const db = await getDb();
    const result = await db.collection('users').updateOne(
      { _id: new ObjectId(payload.userId) },
      { 
        $set: { 
          email_verified: true,
          updated_at: new Date()
        }
      }
    );

    return result.modifiedCount > 0;
  }
}

export default new EmailService(); 
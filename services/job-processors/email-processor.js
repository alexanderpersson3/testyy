const jobQueue = require('../job-queue');
const nodemailer = require('nodemailer');
const { getDb } = require('../../db');
const { ObjectId } = require('mongodb');
const path = require('path');
const fs = require('fs').promises;
const handlebars = require('handlebars');

class EmailProcessor {
  constructor() {
    // Initialize processor
    jobQueue.processQueue('email', this.processJob.bind(this));

    // Email types
    this.EMAIL_TYPES = {
      WELCOME: 'welcome',
      PASSWORD_RESET: 'password_reset',
      EMAIL_VERIFICATION: 'email_verification',
      RECIPE_SHARED: 'recipe_shared',
      PRICE_ALERT: 'price_alert',
      WEEKLY_DIGEST: 'weekly_digest'
    };

    // Initialize email transport
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });

    // Cache for email templates
    this.templateCache = new Map();
  }

  /**
   * Process email job
   */
  async processJob(job) {
    const { type, data } = job.data;

    try {
      switch (type) {
        case this.EMAIL_TYPES.WELCOME:
          return await this.sendWelcomeEmail(data);
        case this.EMAIL_TYPES.PASSWORD_RESET:
          return await this.sendPasswordResetEmail(data);
        case this.EMAIL_TYPES.EMAIL_VERIFICATION:
          return await this.sendVerificationEmail(data);
        case this.EMAIL_TYPES.RECIPE_SHARED:
          return await this.sendRecipeSharedEmail(data);
        case this.EMAIL_TYPES.PRICE_ALERT:
          return await this.sendPriceAlertEmail(data);
        case this.EMAIL_TYPES.WEEKLY_DIGEST:
          return await this.sendWeeklyDigestEmail(data);
        default:
          throw new Error(`Unknown email type: ${type}`);
      }
    } catch (error) {
      console.error(`Error processing email job ${job.id}:`, error);
      await this.logEmailError(type, data, error);
      throw error;
    }
  }

  /**
   * Get email template
   */
  async getTemplate(templateName) {
    if (this.templateCache.has(templateName)) {
      return this.templateCache.get(templateName);
    }

    const templatePath = path.join(__dirname, '../../templates/emails', `${templateName}.hbs`);
    const templateContent = await fs.readFile(templatePath, 'utf-8');
    const template = handlebars.compile(templateContent);
    this.templateCache.set(templateName, template);
    return template;
  }

  /**
   * Send welcome email
   */
  async sendWelcomeEmail(data) {
    const template = await this.getTemplate('welcome');
    const html = template({
      username: data.username,
      verificationLink: data.verificationLink
    });

    const mailOptions = {
      from: process.env.EMAIL_FROM,
      to: data.email,
      subject: 'Welcome to Rezepta!',
      html
    };

    await this.sendEmail(mailOptions);
    await this.logEmailSent(this.EMAIL_TYPES.WELCOME, data);
  }

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail(data) {
    const template = await this.getTemplate('password-reset');
    const html = template({
      username: data.username,
      resetLink: data.resetLink,
      expiresIn: '1 hour'
    });

    const mailOptions = {
      from: process.env.EMAIL_FROM,
      to: data.email,
      subject: 'Reset Your Password',
      html
    };

    await this.sendEmail(mailOptions);
    await this.logEmailSent(this.EMAIL_TYPES.PASSWORD_RESET, data);
  }

  /**
   * Send verification email
   */
  async sendVerificationEmail(data) {
    const template = await this.getTemplate('email-verification');
    const html = template({
      username: data.username,
      verificationLink: data.verificationLink
    });

    const mailOptions = {
      from: process.env.EMAIL_FROM,
      to: data.email,
      subject: 'Verify Your Email',
      html
    };

    await this.sendEmail(mailOptions);
    await this.logEmailSent(this.EMAIL_TYPES.EMAIL_VERIFICATION, data);
  }

  /**
   * Send recipe shared email
   */
  async sendRecipeSharedEmail(data) {
    const template = await this.getTemplate('recipe-shared');
    const html = template({
      recipientName: data.recipientName,
      senderName: data.senderName,
      recipeName: data.recipeName,
      recipeLink: data.recipeLink,
      message: data.message
    });

    const mailOptions = {
      from: process.env.EMAIL_FROM,
      to: data.recipientEmail,
      subject: `${data.senderName} shared a recipe with you!`,
      html
    };

    await this.sendEmail(mailOptions);
    await this.logEmailSent(this.EMAIL_TYPES.RECIPE_SHARED, data);
  }

  /**
   * Send price alert email
   */
  async sendPriceAlertEmail(data) {
    const template = await this.getTemplate('price-alert');
    const html = template({
      username: data.username,
      ingredientName: data.ingredientName,
      currentPrice: data.currentPrice,
      previousPrice: data.previousPrice,
      store: data.store,
      alertLink: data.alertLink
    });

    const mailOptions = {
      from: process.env.EMAIL_FROM,
      to: data.email,
      subject: `Price Alert: ${data.ingredientName}`,
      html
    };

    await this.sendEmail(mailOptions);
    await this.logEmailSent(this.EMAIL_TYPES.PRICE_ALERT, data);
  }

  /**
   * Send weekly digest email
   */
  async sendWeeklyDigestEmail(data) {
    const template = await this.getTemplate('weekly-digest');
    const html = template({
      username: data.username,
      topRecipes: data.topRecipes,
      priceAlerts: data.priceAlerts,
      newFollowers: data.newFollowers,
      weeklyStats: data.weeklyStats
    });

    const mailOptions = {
      from: process.env.EMAIL_FROM,
      to: data.email,
      subject: 'Your Weekly Rezepta Digest',
      html
    };

    await this.sendEmail(mailOptions);
    await this.logEmailSent(this.EMAIL_TYPES.WEEKLY_DIGEST, data);
  }

  /**
   * Send email using nodemailer
   */
  async sendEmail(mailOptions) {
    try {
      await this.transporter.sendMail(mailOptions);
    } catch (error) {
      console.error('Error sending email:', error);
      throw error;
    }
  }

  /**
   * Log sent email
   */
  async logEmailSent(type, data) {
    try {
      const db = getDb();
      await db.collection('email_logs').insertOne({
        type,
        recipient: data.email,
        userId: data.userId ? new ObjectId(data.userId) : null,
        metadata: data,
        status: 'sent',
        sentAt: new Date()
      });
    } catch (error) {
      console.error('Error logging email:', error);
    }
  }

  /**
   * Log email error
   */
  async logEmailError(type, data, error) {
    try {
      const db = getDb();
      await db.collection('email_logs').insertOne({
        type,
        recipient: data.email,
        userId: data.userId ? new ObjectId(data.userId) : null,
        metadata: data,
        status: 'error',
        error: {
          message: error.message,
          stack: error.stack
        },
        timestamp: new Date()
      });
    } catch (logError) {
      console.error('Error logging email error:', logError);
    }
  }
}

// Export singleton instance
module.exports = new EmailProcessor(); 
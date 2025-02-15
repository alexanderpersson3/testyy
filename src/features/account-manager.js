const { getDb } = require('../db');
const { ObjectId } = require('mongodb');
const bcrypt = require('bcryptjs');
const auditLogger = require('./audit-logger');
const sessionManager = require('./session-manager');

class AccountManager {
  constructor() {
    this.REACTIVATION_WINDOW = 30 * 24 * 60 * 60 * 1000; // 30 days
  }

  async deactivateAccount(userId, password) {
    try {
      const db = getDb();

      // Get user
      const user = await db.collection('users').findOne({
        _id: new ObjectId(userId),
      });

      if (!user) {
        throw new Error('User not found');
      }

      // Verify password
      const isValid = await bcrypt.compare(password, user.password);
      if (!isValid) {
        throw new Error('Invalid password');
      }

      // Update user status
      await db.collection('users').updateOne(
        { _id: user._id },
        {
          $set: {
            isActive: false,
            deactivatedAt: new Date(),
            canReactivateUntil: new Date(Date.now() + this.REACTIVATION_WINDOW),
            updatedAt: new Date(),
          },
        }
      );

      // Invalidate all sessions
      await sessionManager.invalidateAllSessions(userId);

      await auditLogger.log(
        auditLogger.eventTypes.USER.ACCOUNT_DEACTIVATE,
        { userId },
        { severity: auditLogger.severityLevels.WARNING }
      );

      return true;
    } catch (err) {
      console.error('Error deactivating account:', err);
      throw err;
    }
  }

  async reactivateAccount(userId) {
    try {
      const db = getDb();

      // Get user
      const user = await db.collection('users').findOne({
        _id: new ObjectId(userId),
        isActive: false,
        canReactivateUntil: { $gt: new Date() },
      });

      if (!user) {
        throw new Error('Account not found or cannot be reactivated');
      }

      // Reactivate account
      await db.collection('users').updateOne(
        { _id: user._id },
        {
          $set: {
            isActive: true,
            deactivatedAt: null,
            canReactivateUntil: null,
            updatedAt: new Date(),
          },
        }
      );

      await auditLogger.log(
        auditLogger.eventTypes.USER.ACCOUNT_REACTIVATE,
        { userId },
        { severity: auditLogger.severityLevels.INFO }
      );

      return true;
    } catch (err) {
      console.error('Error reactivating account:', err);
      throw err;
    }
  }

  async permanentlyDeleteAccount(userId, password) {
    try {
      const db = getDb();

      // Get user
      const user = await db.collection('users').findOne({
        _id: new ObjectId(userId),
      });

      if (!user) {
        throw new Error('User not found');
      }

      // Verify password
      const isValid = await bcrypt.compare(password, user.password);
      if (!isValid) {
        throw new Error('Invalid password');
      }

      // Start transaction
      const session = db.client.startSession();
      try {
        await session.withTransaction(async () => {
          // Delete user data from various collections
          await Promise.all([
            // Delete user's recipes
            db.collection('recipes').deleteMany({ userId: user._id }, { session }),
            // Delete user's reviews
            db.collection('reviews').deleteMany({ userId: user._id }, { session }),
            // Delete user's meal plans
            db.collection('meal_plans').deleteMany({ userId: user._id }, { session }),
            // Delete user's sessions
            db.collection('sessions').deleteMany({ userId: user._id }, { session }),
            // Delete user's media
            db.collection('media').deleteMany({ userId: user._id }, { session }),
            // Delete user's custom ingredients
            db.collection('user_ingredients').deleteMany({ userId: user._id }, { session }),
            // Finally, delete the user
            db.collection('users').deleteOne({ _id: user._id }, { session }),
          ]);
        });
      } finally {
        await session.endSession();
      }

      await auditLogger.log(
        auditLogger.eventTypes.USER.DELETE,
        { userId },
        { severity: auditLogger.severityLevels.WARNING }
      );

      return true;
    } catch (err) {
      console.error('Error deleting account:', err);
      throw err;
    }
  }

  async exportUserData(userId) {
    try {
      const db = getDb();

      // Get user (excluding sensitive fields)
      const user = await db.collection('users').findOne(
        { _id: new ObjectId(userId) },
        {
          projection: {
            password: 0,
            resetToken: 0,
            refreshToken: 0,
          },
        }
      );

      if (!user) {
        throw new Error('User not found');
      }

      // Gather user's data from various collections
      const [recipes, reviews, mealPlans, customIngredients] = await Promise.all([
        // Get user's recipes
        db.collection('recipes').find({ userId: user._id }).toArray(),
        // Get user's reviews
        db.collection('reviews').find({ userId: user._id }).toArray(),
        // Get user's meal plans
        db.collection('meal_plans').find({ userId: user._id }).toArray(),
        // Get user's custom ingredients
        db.collection('user_ingredients').find({ userId: user._id }).toArray(),
      ]);

      const exportData = {
        user: {
          ...user,
          _id: user._id.toString(),
        },
        recipes: recipes.map(recipe => ({
          ...recipe,
          _id: recipe._id.toString(),
          userId: recipe.userId.toString(),
        })),
        reviews: reviews.map(review => ({
          ...review,
          _id: review._id.toString(),
          userId: review.userId.toString(),
        })),
        mealPlans: mealPlans.map(plan => ({
          ...plan,
          _id: plan._id.toString(),
          userId: plan.userId.toString(),
        })),
        customIngredients: customIngredients.map(ingredient => ({
          ...ingredient,
          _id: ingredient._id.toString(),
          userId: ingredient.userId.toString(),
        })),
      };

      await auditLogger.log(
        auditLogger.eventTypes.USER.DATA_EXPORT,
        { userId },
        { severity: auditLogger.severityLevels.INFO }
      );

      return exportData;
    } catch (err) {
      console.error('Error exporting user data:', err);
      throw err;
    }
  }
}

module.exports = new AccountManager();

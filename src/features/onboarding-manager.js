const { getDb } = require('../db');
const { ObjectId } = require('mongodb');
const auditLogger = require('./audit-logger');

class OnboardingManager {
  constructor() {
    this.ONBOARDING_STEPS = {
      PROFILE_SETUP: 'profile_setup',
      PREFERENCES_SETUP: 'preferences_setup',
      DIETARY_PREFERENCES: 'dietary_preferences',
      FAVORITE_CUISINES: 'favorite_cuisines',
      COOKING_SKILL: 'cooking_skill',
      NOTIFICATION_SETUP: 'notification_setup',
      FIRST_RECIPE_VIEW: 'first_recipe_view',
      FIRST_RECIPE_SAVE: 'first_recipe_save',
      FEATURE_TOUR: 'feature_tour',
    };

    this.ONBOARDING_STATUS = {
      NOT_STARTED: 'not_started',
      IN_PROGRESS: 'in_progress',
      COMPLETED: 'completed',
      SKIPPED: 'skipped',
    };
  }

  async initializeOnboarding(userId) {
    try {
      const db = getDb();

      const onboardingState = {
        userId: new ObjectId(userId),
        status: this.ONBOARDING_STATUS.NOT_STARTED,
        progress: {},
        currentStep: this.ONBOARDING_STEPS.PROFILE_SETUP,
        completedSteps: [],
        skippedSteps: [],
        startedAt: new Date(),
        lastUpdatedAt: new Date(),
      };

      // Initialize progress for each step
      Object.values(this.ONBOARDING_STEPS).forEach(step => {
        onboardingState.progress[step] = {
          status: this.ONBOARDING_STATUS.NOT_STARTED,
          completedAt: null,
        };
      });

      await db.collection('user_onboarding').insertOne(onboardingState);

      await auditLogger.log(
        'user.onboarding.initialize',
        { userId },
        { severity: auditLogger.severityLevels.INFO }
      );

      return onboardingState;
    } catch (err) {
      console.error('Error initializing onboarding:', err);
      throw err;
    }
  }

  async getOnboardingState(userId) {
    try {
      const db = getDb();

      const state = await db.collection('user_onboarding').findOne({
        userId: new ObjectId(userId),
      });

      if (!state) {
        return await this.initializeOnboarding(userId);
      }

      return state;
    } catch (err) {
      console.error('Error getting onboarding state:', err);
      throw err;
    }
  }

  async updateStepProgress(userId, step, status, data = {}) {
    try {
      const db = getDb();

      if (!Object.values(this.ONBOARDING_STEPS).includes(step)) {
        throw new Error('Invalid onboarding step');
      }

      if (!Object.values(this.ONBOARDING_STATUS).includes(status)) {
        throw new Error('Invalid status');
      }

      const updateData = {
        [`progress.${step}.status`]: status,
        lastUpdatedAt: new Date(),
      };

      if (status === this.ONBOARDING_STATUS.COMPLETED) {
        updateData[`progress.${step}.completedAt`] = new Date();
        updateData.$push = { completedSteps: step };
      } else if (status === this.ONBOARDING_STATUS.SKIPPED) {
        updateData.$push = { skippedSteps: step };
      }

      // Store any additional data provided
      if (Object.keys(data).length > 0) {
        updateData[`progress.${step}.data`] = data;
      }

      const result = await db
        .collection('user_onboarding')
        .updateOne({ userId: new ObjectId(userId) }, { $set: updateData });

      // Update overall status
      await this.updateOverallStatus(userId);

      await auditLogger.log(
        'user.onboarding.step.update',
        { userId, step, status, data },
        { severity: auditLogger.severityLevels.INFO }
      );

      return result.modifiedCount > 0;
    } catch (err) {
      console.error('Error updating onboarding step:', err);
      throw err;
    }
  }

  async updateOverallStatus(userId) {
    try {
      const db = getDb();

      const state = await this.getOnboardingState(userId);
      const steps = Object.values(this.ONBOARDING_STEPS);

      let newStatus = this.ONBOARDING_STATUS.IN_PROGRESS;
      const completedCount = state.completedSteps.length;
      const skippedCount = state.skippedSteps.length;

      if (completedCount + skippedCount === steps.length) {
        newStatus = this.ONBOARDING_STATUS.COMPLETED;
      } else if (completedCount + skippedCount === 0) {
        newStatus = this.ONBOARDING_STATUS.NOT_STARTED;
      }

      await db.collection('user_onboarding').updateOne(
        { userId: new ObjectId(userId) },
        {
          $set: {
            status: newStatus,
            lastUpdatedAt: new Date(),
          },
        }
      );

      if (newStatus === this.ONBOARDING_STATUS.COMPLETED) {
        await auditLogger.log(
          'user.onboarding.complete',
          { userId },
          { severity: auditLogger.severityLevels.INFO }
        );
      }

      return newStatus;
    } catch (err) {
      console.error('Error updating overall onboarding status:', err);
      throw err;
    }
  }

  async getNextStep(userId) {
    try {
      const state = await this.getOnboardingState(userId);
      const steps = Object.values(this.ONBOARDING_STEPS);

      for (const step of steps) {
        if (!state.completedSteps.includes(step) && !state.skippedSteps.includes(step)) {
          return step;
        }
      }

      return null;
    } catch (err) {
      console.error('Error getting next onboarding step:', err);
      throw err;
    }
  }

  async resetOnboarding(userId) {
    try {
      const db = getDb();

      await db.collection('user_onboarding').deleteOne({
        userId: new ObjectId(userId),
      });

      const newState = await this.initializeOnboarding(userId);

      await auditLogger.log(
        'user.onboarding.reset',
        { userId },
        { severity: auditLogger.severityLevels.INFO }
      );

      return newState;
    } catch (err) {
      console.error('Error resetting onboarding:', err);
      throw err;
    }
  }
}

module.exports = new OnboardingManager();

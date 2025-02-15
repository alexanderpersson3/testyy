import { getDb } from '../config/db.js';
import { ObjectId } from 'mongodb';

class GamificationManager {
  constructor() {
    // XP thresholds for each level
    this.levelThresholds = {
      1: 0,
      2: 500,
      3: 1000,
      4: 2500,
      5: 5000,
      // Add more levels as needed
    };
  }

  /**
   * Award XP to a user and check for level up
   * @param {string} userId User ID
   * @param {number} xp XP to award
   * @returns {Promise<Object>} Updated user XP and level info
   */
  async awardXp(userId, xp) {
    try {
      const db = getDb();
      const user = await db
        .collection('users')
        .findOne({ _id: new ObjectId(userId) }, { projection: { currentXp: 1, level: 1 } });

      if (!user) {
        throw new Error('User not found');
      }

      const newXp = (user.currentXp || 0) + xp;
      const currentLevel = user.level || 1;

      // Check for level up
      let newLevel = currentLevel;
      for (const [level, threshold] of Object.entries(this.levelThresholds)) {
        if (newXp >= threshold && Number(level) > newLevel) {
          newLevel = Number(level);
        }
      }

      // Update user
      const result = await db.collection('users').findOneAndUpdate(
        { _id: new ObjectId(userId) },
        {
          $set: {
            currentXp: newXp,
            level: newLevel,
            updatedAt: new Date(),
          },
        },
        { returnDocument: 'after' }
      );

      // Check for and award any XP-based badges
      if (newLevel > currentLevel) {
        await this.checkAndAwardLevelBadges(userId, newLevel);
      }

      return {
        currentXp: newXp,
        level: newLevel,
        leveledUp: newLevel > currentLevel,
        xpToNextLevel: this.getXpToNextLevel(newXp, newLevel),
      };
    } catch (error) {
      console.error('Error awarding XP:', error);
      throw error;
    }
  }

  /**
   * Get XP needed for next level
   * @param {number} currentXp Current XP
   * @param {number} currentLevel Current level
   * @returns {number} XP needed for next level
   */
  getXpToNextLevel(currentXp, currentLevel) {
    const nextLevel = currentLevel + 1;
    const nextThreshold = this.levelThresholds[nextLevel];

    if (!nextThreshold) {
      return 0; // Max level reached
    }

    return nextThreshold - currentXp;
  }

  /**
   * Award a badge to a user
   * @param {string} userId User ID
   * @param {string} badgeId Badge ID
   * @returns {Promise<Object>} Award result
   */
  async awardBadge(userId, badgeId) {
    try {
      const db = getDb();

      // Check if user already has badge
      const existing = await db.collection('userBadges').findOne({
        userId: new ObjectId(userId),
        badgeId: new ObjectId(badgeId),
      });

      if (existing) {
        return { alreadyAwarded: true };
      }

      // Award badge
      await db.collection('userBadges').insertOne({
        userId: new ObjectId(userId),
        badgeId: new ObjectId(badgeId),
        awardedAt: new Date(),
      });

      // Get badge details
      const badge = await db.collection('badges').findOne({
        _id: new ObjectId(badgeId),
      });

      return {
        awarded: true,
        badge,
      };
    } catch (error) {
      console.error('Error awarding badge:', error);
      throw error;
    }
  }

  /**
   * Check and award level-based badges
   * @param {string} userId User ID
   * @param {number} level Current level
   */
  async checkAndAwardLevelBadges(userId, level) {
    try {
      const db = getDb();

      // Get level-based badges that match current level
      const badges = await db
        .collection('badges')
        .find({
          type: 'level',
          requiredLevel: { $lte: level },
        })
        .toArray();

      // Award any badges user doesn't have yet
      for (const badge of badges) {
        await this.awardBadge(userId, badge._id.toString());
      }
    } catch (error) {
      console.error('Error checking level badges:', error);
      // Don't throw, just log the error
    }
  }

  /**
   * Start a challenge for a user
   * @param {string} userId User ID
   * @param {string} challengeId Challenge ID
   * @returns {Promise<Object>} Challenge progress
   */
  async startChallenge(userId, challengeId) {
    try {
      const db = getDb();

      // Get challenge details
      const challenge = await db.collection('challenges').findOne({
        _id: new ObjectId(challengeId),
      });

      if (!challenge) {
        throw new Error('Challenge not found');
      }

      // Check if user already started this challenge
      const existing = await db.collection('userChallenges').findOne({
        userId: new ObjectId(userId),
        challengeId: new ObjectId(challengeId),
        status: { $in: ['in_progress', 'completed'] },
      });

      if (existing) {
        throw new Error('Challenge already started');
      }

      // Initialize progress tracking
      const progress = {
        userId: new ObjectId(userId),
        challengeId: new ObjectId(challengeId),
        status: 'in_progress',
        requirements: {},
        startedAt: new Date(),
        updatedAt: new Date(),
      };

      // Initialize requirement tracking
      for (const [key, value] of Object.entries(challenge.requirements)) {
        progress.requirements[key] = {
          required: value,
          current: 0,
        };
      }

      await db.collection('userChallenges').insertOne(progress);

      return {
        ...progress,
        challenge,
      };
    } catch (error) {
      console.error('Error starting challenge:', error);
      throw error;
    }
  }

  /**
   * Update challenge progress for a user
   * @param {string} userId User ID
   * @param {string} challengeId Challenge ID
   * @param {string} requirement Requirement key
   * @param {number} increment Amount to increment
   * @returns {Promise<Object>} Updated progress and completion status
   */
  async updateChallengeProgress(userId, challengeId, requirement, increment = 1) {
    try {
      const db = getDb();

      // Get user's challenge progress
      const progress = await db.collection('userChallenges').findOne({
        userId: new ObjectId(userId),
        challengeId: new ObjectId(challengeId),
        status: 'in_progress',
      });

      if (!progress) {
        return null; // Challenge not started or already completed
      }

      // Update requirement progress
      const updateKey = `requirements.${requirement}.current`;
      const result = await db.collection('userChallenges').findOneAndUpdate(
        {
          _id: progress._id,
        },
        {
          $inc: { [updateKey]: increment },
          $set: { updatedAt: new Date() },
        },
        { returnDocument: 'after' }
      );

      // Check if challenge is completed
      const challenge = await db.collection('challenges').findOne({
        _id: new ObjectId(challengeId),
      });

      const isCompleted = Object.entries(result.requirements).every(
        ([key, value]) => value.current >= challenge.requirements[key]
      );

      if (isCompleted) {
        // Mark challenge as completed
        await db.collection('userChallenges').updateOne(
          { _id: result._id },
          {
            $set: {
              status: 'completed',
              completedAt: new Date(),
            },
          }
        );

        // Award XP and badge if applicable
        const xpResult = await this.awardXp(userId, challenge.xpReward);
        let badgeResult = null;

        if (challenge.badgeRewardId) {
          badgeResult = await this.awardBadge(userId, challenge.badgeRewardId);
        }

        return {
          progress: result,
          completed: true,
          rewards: {
            xp: xpResult,
            badge: badgeResult,
          },
        };
      }

      return {
        progress: result,
        completed: false,
      };
    } catch (error) {
      console.error('Error updating challenge progress:', error);
      throw error;
    }
  }
}

export default new GamificationManager();

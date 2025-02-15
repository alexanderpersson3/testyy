import { getDb } from '../config/db.js';
import { ObjectId } from 'mongodb';

class ChallengeManager {
  constructor() {
    // Valid requirement types
    this.validRequirements = [
      'create_recipe',
      'remix_recipe',
      'share_recipe',
      'follow_user',
      'refer_friend',
      'use_deal',
      'create_meal_plan',
      'comment',
      'upload_photo',
    ];
  }

  /**
   * Create a new challenge
   * @param {Object} data Challenge data
   * @param {string} creatorId Creator user ID
   * @returns {Promise<Object>} Created challenge
   */
  async createChallenge(data, creatorId) {
    try {
      const db = getDb();

      // Validate requirements
      for (const [key] of Object.entries(data.requirements)) {
        if (!this.validRequirements.includes(key)) {
          throw new Error(`Invalid requirement type: ${key}`);
        }
      }

      const challenge = {
        ...data,
        creatorUserId: new ObjectId(creatorId),
        status: 'active',
        participantCount: 0,
        completionCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = await db.collection('challenges').insertOne(challenge);
      return {
        ...challenge,
        _id: result.insertedId,
      };
    } catch (error) {
      console.error('Error creating challenge:', error);
      throw error;
    }
  }

  /**
   * Get challenge details
   * @param {string} challengeId Challenge ID
   * @returns {Promise<Object>} Challenge details
   */
  async getChallenge(challengeId) {
    try {
      const db = getDb();

      const challenge = await db
        .collection('challenges')
        .aggregate([
          {
            $match: {
              _id: new ObjectId(challengeId),
            },
          },
          {
            $lookup: {
              from: 'users',
              localField: 'creatorUserId',
              foreignField: '_id',
              as: 'creator',
            },
          },
          {
            $unwind: '$creator',
          },
          {
            $project: {
              'creator.password': 0,
              'creator.email': 0,
            },
          },
        ])
        .next();

      if (!challenge) {
        throw new Error('Challenge not found');
      }

      return challenge;
    } catch (error) {
      console.error('Error getting challenge:', error);
      throw error;
    }
  }

  /**
   * Get challenges with filters and search
   * @param {Object} options Query options
   * @returns {Promise<Array>} Challenges
   */
  async getChallenges({
    limit = 20,
    offset = 0,
    status = 'active',
    type,
    creatorId,
    search,
    sortBy = 'participantCount',
    sortOrder = -1,
  } = {}) {
    try {
      const db = getDb();
      const query = { status };

      if (type) {
        query.type = type;
      }
      if (creatorId) {
        query.creatorUserId = new ObjectId(creatorId);
      }
      if (search) {
        query.$or = [
          { title: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } },
        ];
      }

      const challenges = await db
        .collection('challenges')
        .aggregate([
          { $match: query },
          {
            $lookup: {
              from: 'users',
              localField: 'creatorUserId',
              foreignField: '_id',
              as: 'creator',
            },
          },
          { $unwind: '$creator' },
          {
            $project: {
              'creator.password': 0,
              'creator.email': 0,
            },
          },
          { $sort: { [sortBy]: sortOrder } },
          { $skip: offset },
          { $limit: limit },
        ])
        .toArray();

      const total = await db.collection('challenges').countDocuments(query);

      return {
        challenges,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + challenges.length < total,
        },
      };
    } catch (error) {
      console.error('Error getting challenges:', error);
      throw error;
    }
  }

  /**
   * Get suggested challenges for a user
   * @param {string} userId User ID
   * @returns {Promise<Array>} Suggested challenges
   */
  async getSuggestedChallenges(userId) {
    try {
      const db = getDb();

      // Get user's completed challenges and preferences
      const user = await db
        .collection('users')
        .findOne({ _id: new ObjectId(userId) }, { projection: { preferences: 1 } });

      const completedChallenges = await db
        .collection('userChallenges')
        .find({
          userId: new ObjectId(userId),
          status: 'completed',
        })
        .project({ challengeId: 1 })
        .toArray();

      const completedIds = completedChallenges.map(c => c.challengeId);

      // Find active challenges user hasn't completed
      const challenges = await db
        .collection('challenges')
        .aggregate([
          {
            $match: {
              _id: { $nin: completedIds },
              status: 'active',
            },
          },
          {
            $lookup: {
              from: 'users',
              localField: 'creatorUserId',
              foreignField: '_id',
              as: 'creator',
            },
          },
          { $unwind: '$creator' },
          {
            $project: {
              'creator.password': 0,
              'creator.email': 0,
            },
          },
          // Add relevance score based on user preferences and challenge popularity
          {
            $addFields: {
              relevanceScore: {
                $add: [
                  '$participantCount',
                  {
                    $cond: {
                      if: {
                        $in: ['$type', user.preferences?.interests || []],
                      },
                      then: 100,
                      else: 0,
                    },
                  },
                ],
              },
            },
          },
          { $sort: { relevanceScore: -1 } },
          { $limit: 5 },
        ])
        .toArray();

      return challenges;
    } catch (error) {
      console.error('Error getting suggested challenges:', error);
      throw error;
    }
  }

  /**
   * Update challenge statistics
   * @param {string} challengeId Challenge ID
   * @param {string} type Update type
   * @returns {Promise<void>}
   */
  async updateChallengeStats(challengeId, type) {
    try {
      const db = getDb();
      const update = {};

      if (type === 'start') {
        update.$inc = { participantCount: 1 };
      } else if (type === 'complete') {
        update.$inc = { completionCount: 1 };
      }

      if (Object.keys(update).length > 0) {
        await db.collection('challenges').updateOne({ _id: new ObjectId(challengeId) }, update);
      }
    } catch (error) {
      console.error('Error updating challenge stats:', error);
      // Don't throw, just log the error
    }
  }
}

export default new ChallengeManager();

import { getDb } from '../config/db.js';
import { ObjectId } from 'mongodb';
import Filter from 'bad-words';
import svProfanityList from '../config/profanity-sv.js';

class ReviewManager {
  constructor() {
    // Initialize profanity filters for both languages
    this.enFilter = new Filter();
    this.svFilter = new Filter({ list: svProfanityList });
  }

  /**
   * Create a new review
   * @param {Object} reviewData Review data
   * @returns {Promise<Object>} Created review
   */
  async createReview(reviewData) {
    try {
      const db = getDb();

      // Validate rating
      if (reviewData.rating < 0 || reviewData.rating > 5) {
        throw new Error('Rating must be between 0 and 5');
      }

      // Check for existing review by user
      const existingReview = await db.collection('reviews').findOne({
        recipeId: new ObjectId(reviewData.recipeId),
        userId: new ObjectId(reviewData.userId),
      });

      if (existingReview) {
        throw new Error('User has already reviewed this recipe');
      }

      // Check if user has purchased ingredients or premium content
      const isVerifiedPurchase = await this.checkVerifiedPurchase(
        reviewData.userId,
        reviewData.recipeId
      );

      // Filter profanity in both languages
      const cleanComment = this.filterProfanity(reviewData.commentText);

      const review = {
        recipeId: new ObjectId(reviewData.recipeId),
        userId: new ObjectId(reviewData.userId),
        rating: parseFloat(reviewData.rating.toFixed(1)),
        commentText: cleanComment,
        isVerifiedPurchase,
        helpfulVotes: 0,
        unhelpfulVotes: 0,
        votedUserIds: [],
        status: 'active',
        flags: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = await db.collection('reviews').insertOne(review);

      // Update recipe average rating
      await this.updateRecipeRating(reviewData.recipeId);

      return { ...review, _id: result.insertedId };
    } catch (error) {
      console.error('Error creating review:', error);
      throw error;
    }
  }

  /**
   * Update an existing review
   * @param {string} reviewId Review ID
   * @param {Object} updates Updates to apply
   * @returns {Promise<Object>} Updated review
   */
  async updateReview(reviewId, updates) {
    try {
      const db = getDb();

      // Validate rating if provided
      if (updates.rating !== undefined) {
        if (updates.rating < 0 || updates.rating > 5) {
          throw new Error('Rating must be between 0 and 5');
        }
        updates.rating = parseFloat(updates.rating.toFixed(1));
      }

      // Filter profanity if comment is updated
      if (updates.commentText) {
        updates.commentText = this.filterProfanity(updates.commentText);
      }

      const result = await db.collection('reviews').findOneAndUpdate(
        { _id: new ObjectId(reviewId) },
        {
          $set: {
            ...updates,
            updatedAt: new Date(),
          },
        },
        { returnDocument: 'after' }
      );

      if (!result.value) {
        throw new Error('Review not found');
      }

      // Update recipe average rating if rating changed
      if (updates.rating !== undefined) {
        await this.updateRecipeRating(result.value.recipeId);
      }

      return result.value;
    } catch (error) {
      console.error('Error updating review:', error);
      throw error;
    }
  }

  /**
   * Get reviews for a recipe
   * @param {string} recipeId Recipe ID
   * @param {Object} options Query options
   * @returns {Promise<Array>} List of reviews
   */
  async getRecipeReviews(recipeId, { page = 1, limit = 10, sort = 'newest' } = {}) {
    try {
      const db = getDb();
      const skip = (page - 1) * limit;

      const sortOptions = {
        newest: { createdAt: -1 },
        oldest: { createdAt: 1 },
        highestRating: { rating: -1 },
        lowestRating: { rating: 1 },
      };

      return await db
        .collection('reviews')
        .aggregate([
          {
            $match: {
              recipeId: new ObjectId(recipeId),
              status: 'active',
            },
          },
          {
            $lookup: {
              from: 'users',
              localField: 'userId',
              foreignField: '_id',
              as: 'user',
            },
          },
          { $unwind: '$user' },
          {
            $project: {
              rating: 1,
              commentText: 1,
              createdAt: 1,
              updatedAt: 1,
              'user.displayName': 1,
              'user.profileImage': 1,
            },
          },
          { $sort: sortOptions[sort] },
          { $skip: skip },
          { $limit: limit },
        ])
        .toArray();
    } catch (error) {
      console.error('Error getting recipe reviews:', error);
      throw error;
    }
  }

  /**
   * Flag a review for moderation
   * @param {string} reviewId Review ID
   * @param {string} userId User ID flagging the review
   * @param {string} reason Reason for flagging
   */
  async flagReview(reviewId, userId, reason) {
    try {
      const db = getDb();

      const result = await db.collection('reviews').updateOne(
        { _id: new ObjectId(reviewId) },
        {
          $addToSet: {
            flags: {
              userId: new ObjectId(userId),
              reason,
              createdAt: new Date(),
            },
          },
          $set: {
            status: 'flagged',
            updatedAt: new Date(),
          },
        }
      );

      if (result.matchedCount === 0) {
        throw new Error('Review not found');
      }
    } catch (error) {
      console.error('Error flagging review:', error);
      throw error;
    }
  }

  /**
   * Get flagged reviews for moderation
   * @param {Object} options Query options
   * @returns {Promise<Array>} List of flagged reviews
   */
  async getFlaggedReviews({ page = 1, limit = 20 } = {}) {
    try {
      const db = getDb();
      const skip = (page - 1) * limit;

      return await db
        .collection('reviews')
        .aggregate([
          {
            $match: {
              status: 'flagged',
            },
          },
          {
            $lookup: {
              from: 'users',
              localField: 'userId',
              foreignField: '_id',
              as: 'user',
            },
          },
          { $unwind: '$user' },
          {
            $project: {
              rating: 1,
              commentText: 1,
              flags: 1,
              createdAt: 1,
              updatedAt: 1,
              'user.displayName': 1,
            },
          },
          { $sort: { updatedAt: -1 } },
          { $skip: skip },
          { $limit: limit },
        ])
        .toArray();
    } catch (error) {
      console.error('Error getting flagged reviews:', error);
      throw error;
    }
  }

  /**
   * Update recipe's average rating
   * @param {string} recipeId Recipe ID
   */
  async updateRecipeRating(recipeId) {
    try {
      const db = getDb();

      const pipeline = [
        {
          $match: {
            recipeId: new ObjectId(recipeId),
            status: 'active',
          },
        },
        {
          $group: {
            _id: null,
            averageRating: { $avg: '$rating' },
            reviewCount: { $sum: 1 },
          },
        },
      ];

      const [result] = await db.collection('reviews').aggregate(pipeline).toArray();

      // Only show rating if there is at least one review
      if (result && result.reviewCount > 0) {
        await db.collection('recipes').updateOne(
          { _id: new ObjectId(recipeId) },
          {
            $set: {
              averageRating: parseFloat(result.averageRating.toFixed(1)),
              reviewCount: result.reviewCount,
              hasRating: true,
            },
          }
        );
      } else {
        // Reset rating if no reviews
        await db.collection('recipes').updateOne(
          { _id: new ObjectId(recipeId) },
          {
            $set: {
              averageRating: null,
              reviewCount: 0,
              hasRating: false,
            },
          }
        );
      }
    } catch (error) {
      console.error('Error updating recipe rating:', error);
      throw error;
    }
  }

  /**
   * Get recipe rating summary
   * @param {string} recipeId Recipe ID
   * @returns {Promise<Object>} Rating summary
   */
  async getRecipeRatingSummary(recipeId) {
    try {
      const db = getDb();

      const recipe = await db
        .collection('recipes')
        .findOne(
          { _id: new ObjectId(recipeId) },
          { projection: { averageRating: 1, reviewCount: 1, hasRating: 1 } }
        );

      if (!recipe) {
        throw new Error('Recipe not found');
      }

      // Only return rating data if there are reviews
      if (recipe.hasRating) {
        return {
          averageRating: recipe.averageRating,
          reviewCount: recipe.reviewCount,
          hasRating: true,
        };
      }

      return {
        averageRating: null,
        reviewCount: 0,
        hasRating: false,
      };
    } catch (error) {
      console.error('Error getting recipe rating summary:', error);
      throw error;
    }
  }

  /**
   * Filter profanity in both English and Swedish
   * @param {string} text Text to filter
   * @returns {string} Filtered text
   */
  filterProfanity(text) {
    if (!text) return text;
    return this.svFilter.clean(this.enFilter.clean(text));
  }

  /**
   * Vote on a review's helpfulness
   * @param {string} reviewId Review ID
   * @param {string} userId User ID
   * @param {boolean} isHelpful Whether the vote is helpful
   * @returns {Promise<Object>} Updated vote counts
   */
  async voteReview(reviewId, userId, isHelpful) {
    try {
      const db = getDb();
      const review = await db.collection('reviews').findOne({
        _id: new ObjectId(reviewId),
      });

      if (!review) {
        throw new Error('Review not found');
      }

      // Check if user has already voted
      if (review.votedUserIds.some(id => id.equals(new ObjectId(userId)))) {
        throw new Error('User has already voted on this review');
      }

      const update = {
        $push: { votedUserIds: new ObjectId(userId) },
        $inc: isHelpful ? { helpfulVotes: 1 } : { unhelpfulVotes: 1 },
        $set: { updatedAt: new Date() },
      };

      await db.collection('reviews').updateOne({ _id: new ObjectId(reviewId) }, update);

      const updatedReview = await db.collection('reviews').findOne({
        _id: new ObjectId(reviewId),
      });

      return {
        helpfulVotes: updatedReview.helpfulVotes,
        unhelpfulVotes: updatedReview.unhelpfulVotes,
      };
    } catch (error) {
      console.error('Error voting on review:', error);
      throw error;
    }
  }

  /**
   * Add author response to a review
   * @param {string} reviewId Review ID
   * @param {string} authorId Author user ID
   * @param {string} responseText Response text
   * @returns {Promise<Object>} Updated review
   */
  async addAuthorResponse(reviewId, authorId, responseText) {
    try {
      const db = getDb();

      // Get review and recipe to verify author
      const review = await db.collection('reviews').findOne({
        _id: new ObjectId(reviewId),
      });

      if (!review) {
        throw new Error('Review not found');
      }

      const recipe = await db.collection('recipes').findOne({
        _id: review.recipeId,
      });

      if (!recipe.userId.equals(new ObjectId(authorId))) {
        throw new Error('Only the recipe author can respond to reviews');
      }

      // Filter profanity in response
      const cleanResponse = this.filterProfanity(responseText);

      const update = {
        $set: {
          authorResponse: {
            text: cleanResponse,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          updatedAt: new Date(),
        },
      };

      await db.collection('reviews').updateOne({ _id: new ObjectId(reviewId) }, update);

      return await db.collection('reviews').findOne({
        _id: new ObjectId(reviewId),
      });
    } catch (error) {
      console.error('Error adding author response:', error);
      throw error;
    }
  }

  /**
   * Check if a user has verified purchase status
   * @param {string} userId User ID
   * @param {string} recipeId Recipe ID
   * @returns {Promise<boolean>} Whether user has verified purchase
   */
  async checkVerifiedPurchase(userId, recipeId) {
    try {
      const db = getDb();

      // Check if user has purchased any ingredients from the recipe
      const recipe = await db.collection('recipes').findOne({
        _id: new ObjectId(recipeId),
      });

      if (!recipe) {
        return false;
      }

      // Get ingredient IDs from recipe
      const ingredientIds = recipe.ingredients.map(ing => ing.ingredientId);

      // Check purchase history
      const hasPurchased = await db.collection('purchases').findOne({
        userId: new ObjectId(userId),
        'items.ingredientId': { $in: ingredientIds },
        status: 'completed',
      });

      // Also verify if user has premium access or has purchased premium content
      const user = await db.collection('users').findOne({
        _id: new ObjectId(userId),
      });

      return !!(hasPurchased || user.isPremium || user.purchasedRecipes?.includes(recipe._id));
    } catch (error) {
      console.error('Error checking verified purchase:', error);
      return false;
    }
  }
}

export default new ReviewManager();

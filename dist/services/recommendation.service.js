import { ObjectId } from 'mongodb';
;
import { DatabaseService } from '../db/database.service.js';
export class RecommendationService {
    constructor(db) {
        this.config = {
            weights: {
                preferences: 0.3,
                history: 0.2,
                popularity: 0.2,
                seasonality: 0.1,
                difficulty: 0.1,
                timing: 0.1,
            },
            thresholds: {
                viewThreshold: 1000,
                saveThreshold: 100,
                ratingThreshold: 5,
            },
            decay: {
                viewHalfLife: 7, // 7 days
                saveHalfLife: 30, // 30 days
            },
        };
        this.db = db;
    }
    static getInstance(db) {
        if (!RecommendationService.instance) {
            RecommendationService.instance = new RecommendationService(db);
        }
        return RecommendationService.instance;
    }
    /**
     * Get recommendations
     */
    async getRecommendations(userId, limit = 10) {
        try {
            const recipes = await this.db
                .getCollection('recipes')
                .find({ isActive: true })
                .sort({ viewCount: -1, rating: -1 })
                .limit(limit)
                .toArray();
            return recipes;
        }
        catch (error) {
            console.error('Error getting recommendations:', error);
            return [];
        }
    }
    /**
     * Get trending recipes
     */
    async getTrendingRecipes(options = {}) {
        try {
            const { timeframe = 'week', category, limit = 10 } = options;
            // Calculate date range
            const now = new Date();
            let startDate;
            switch (timeframe) {
                case 'day':
                    startDate = new Date(now.setDate(now.getDate() - 1));
                    break;
                case 'month':
                    startDate = new Date(now.setMonth(now.getMonth() - 1));
                    break;
                default: // week
                    startDate = new Date(now.setDate(now.getDate() - 7));
            }
            // Get view counts for recipes in date range
            const viewCounts = await this.db
                .getCollection('recipe_views')
                .aggregate([
                {
                    $match: {
                        viewedAt: { $gte: startDate },
                    },
                },
                {
                    $group: {
                        _id: '$recipeId',
                        count: { $sum: 1 },
                    },
                },
                {
                    $sort: { count: -1 },
                },
                {
                    $limit: limit * 2, // Get more than needed to account for filtering
                },
            ])
                .toArray();
            // Get recipe details
            const recipeIds = viewCounts.map(v => v._id);
            const query = {
                _id: { $in: recipeIds },
                isActive: true,
            };
            if (category) {
                query.category = category;
            }
            const recipes = await this.db
                .getCollection('recipes')
                .find(query)
                .limit(limit)
                .toArray();
            // Sort by view count
            return recipes.sort((a, b) => {
                const aCount = viewCounts.find(v => v._id.equals(a._id))?.count || 0;
                const bCount = viewCounts.find(v => v._id.equals(b._id))?.count || 0;
                return bCount - aCount;
            });
        }
        catch (error) {
            console.error('Error getting trending recipes:', error);
            return [];
        }
    }
    /**
     * Submit feedback for a recommendation
     */
    async submitFeedback(userId, recipeId, type, action, reason) {
        try {
            const now = new Date();
            await this.db.getCollection('recommendation_feedback').insertOne({
                _id: new ObjectId(),
                userId: new ObjectId(userId),
                recipeId: new ObjectId(recipeId),
                recommendationType: type,
                action,
                reason,
                timestamp: now,
                createdAt: now,
                updatedAt: now
            });
            await this.updateRecommendationScores(userId, recipeId, type, action);
        }
        catch (error) {
            console.error('Error submitting feedback:', error);
        }
    }
    /**
     * Update recommendation scores
     */
    async updateRecommendationScores(userId, recipeId, type, action) {
        try {
            const score = await this.db
                .getCollection('recommendation_scores')
                .findOne({
                recipeId: new ObjectId(recipeId),
                type,
            });
            const baseScore = score?.score || 0.5;
            const newScore = this.calculateNewScore(baseScore, action);
            const now = new Date();
            await this.db.getCollection('recommendation_scores').updateOne({
                recipeId: new ObjectId(recipeId),
                type,
            }, {
                $set: {
                    score: newScore,
                    lastUpdated: now,
                    updatedAt: now
                },
                $setOnInsert: {
                    _id: new ObjectId(),
                    createdAt: now
                }
            }, { upsert: true });
        }
        catch (error) {
            console.error('Error updating recommendation scores:', error);
        }
    }
    /**
     * Calculate new score based on feedback
     */
    calculateNewScore(currentScore, action) {
        switch (action) {
            case 'accept':
                return Math.min(1, currentScore + 0.1);
            case 'reject':
                return Math.max(0, currentScore - 0.1);
            default:
                return currentScore;
        }
    }
}
//# sourceMappingURL=recommendation.service.js.map
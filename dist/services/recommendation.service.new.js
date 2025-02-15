import { ObjectId } from 'mongodb';
;
import { DatabaseService } from '../db/database.service.js';
import { RecommendationType, ViewRecord, ActionRecord, UserBehavior, RecommendationMetrics, RecommendationFeedback, RecommendationScore, RecommendationResult, UserPreference, } from '../types/recommendation.js';
export class RecommendationService {
    constructor(db) {
        this.db = db;
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
    }
    static getInstance(db) {
        if (!RecommendationService.instance) {
            RecommendationService.instance = new RecommendationService(db);
        }
        return RecommendationService.instance;
    }
    /**
     * Get personalized recommendations
     */
    async getPersonalizedRecommendations(userId, options = {}) {
        try {
            const { limit = 10 } = options;
            // Get user's preferences and behavior
            const [preferences, behaviors] = await Promise.all([
                this.getUserPreference(userId),
                this.getUserBehavior(userId),
            ]);
            // Get recipe pool
            const recipes = await this.db
                .getCollection('recipes')
                .find({
                _id: { $nin: options.excludeIds || [] },
                isActive: true,
            })
                .toArray();
            // Calculate scores and sort
            const scoredRecipes = await this.calculateScores(recipes, preferences, behaviors, 'personalized');
            return scoredRecipes
                .sort((a, b) => b.matchScore - a.matchScore)
                .slice(0, limit)
                .map((r) => r.recipe);
        }
        catch (error) {
            console.error('Error getting personalized recommendations:', error);
            return [];
        }
    }
    /**
     * Get user behavior
     */
    async getUserBehavior(userId) {
        try {
            const [views, likes, saves] = await Promise.all([
                this.db
                    .getCollection('recipe_views')
                    .find({ userId })
                    .sort({ viewedAt: -1 })
                    .limit(100)
                    .toArray(),
                this.db
                    .getCollection('recipe_likes')
                    .find({ userId })
                    .sort({ createdAt: -1 })
                    .limit(100)
                    .toArray(),
                this.db
                    .getCollection('recipe_saves')
                    .find({ userId })
                    .sort({ createdAt: -1 })
                    .limit(100)
                    .toArray(),
            ]);
            const behavior = {
                views,
                likes,
                saves,
            };
            return [behavior];
        }
        catch (error) {
            console.error('Error getting user behavior:', error);
            return [];
        }
    }
    /**
     * Track recommendation metrics
     */
    async trackMetrics(userId, type, action) {
        try {
            const metrics = await this.db
                .getCollection('recommendation_metrics')
                .findOne({
                userId: new ObjectId(userId),
                recommendationType: type,
            });
            const update = {
                $inc: {
                    [`${action}s`]: 1,
                    total: 1,
                },
                $set: {
                    timestamp: new Date(),
                    ctr: await this.calculateCTR(userId, type),
                },
            };
            await this.db
                .getCollection('recommendation_metrics')
                .updateOne({ userId: new ObjectId(userId), recommendationType: type }, update, {
                upsert: true,
            });
        }
        catch (error) {
            console.error('Error tracking metrics:', error);
        }
    }
    /**
     * Submit feedback for a recommendation
     */
    async submitFeedback(userId, recipeId, type, action, reason) {
        try {
            await this.db.getCollection('recommendation_feedback').insertOne({
                userId: new ObjectId(userId),
                recipeId: new ObjectId(recipeId),
                recommendationType: type,
                action,
                reason,
                timestamp: new Date(),
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
            await this.db.getCollection('recommendation_scores').updateOne({
                recipeId: new ObjectId(recipeId),
                type,
            }, {
                $set: {
                    score: newScore,
                    lastUpdated: new Date(),
                },
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
    /**
     * Calculate CTR for a recommendation type
     */
    async calculateCTR(userId, type) {
        const metrics = await this.db
            .getCollection('recommendation_metrics')
            .findOne({
            userId: new ObjectId(userId),
            recommendationType: type,
        });
        if (!metrics || !metrics.impressions || metrics.impressions === 0) {
            return 0;
        }
        return (metrics.clicks || 0) / metrics.impressions;
    }
    /**
     * Get user preferences
     */
    async getUserPreference(userId) {
        return await this.db.getCollection('user_preferences').findOne({ userId });
    }
    /**
     * Calculate scores for recipes
     */
    async calculateScores(recipes, preferences, behaviors, type) {
        return recipes.map(recipe => {
            const scores = {
                preferences: preferences ? this.calculatePreferenceScore(recipe, preferences) : 0,
                history: behaviors.reduce((total, behavior) => total + this.calculateHistoryScore(recipe, behavior), 0),
                popularity: this.calculatePopularityScore(recipe),
                seasonality: this.calculateSeasonalityScore(recipe),
                difficulty: preferences ? this.calculateDifficultyScore(recipe, preferences) : 0,
                timing: preferences ? this.calculateTimingScore(recipe, preferences) : 0,
            };
            const matchScore = Object.entries(scores).reduce((total, [factor, score]) => total + score * this.config.weights[factor], 0);
            return {
                recipe,
                matchScore,
                matchFactors: scores,
            };
        });
    }
    /**
     * Calculate preference score
     */
    calculatePreferenceScore(recipe, preferences) {
        let score = 0;
        const weights = {
            cuisine: 0.3,
            ingredients: 0.3,
            dietary: 0.4,
        };
        // Cuisine match
        if (recipe.cuisine && preferences.cuisinePreferences.includes(recipe.cuisine)) {
            score += weights.cuisine;
        }
        // Ingredient matches
        const recipeIngredients = recipe.ingredients.map(i => i.name.toLowerCase());
        const favoriteMatches = preferences.favoriteIngredients.filter(i => recipeIngredients.includes(i.toLowerCase())).length;
        const dislikedMatches = preferences.dislikedIngredients.filter(i => recipeIngredients.includes(i.toLowerCase())).length;
        score += weights.ingredients * (favoriteMatches / recipe.ingredients.length);
        score -= weights.ingredients * (dislikedMatches / recipe.ingredients.length);
        // Dietary restrictions
        const dietaryMatch = preferences.dietaryRestrictions.every(restriction => {
            switch (restriction) {
                case 'vegetarian':
                    return !recipe.tags.some(tag => tag === 'meat' || tag === 'fish');
                case 'vegan':
                    return !recipe.tags.some(tag => tag === 'meat' ||
                        tag === 'fish' ||
                        tag === 'dairy' ||
                        tag === 'eggs');
                case 'glutenFree':
                    return recipe.tags.includes('gluten-free');
                case 'dairyFree':
                    return !recipe.tags.some(tag => tag === 'dairy');
                case 'keto':
                    return recipe.nutritionalInfo?.carbohydrates
                        ? recipe.nutritionalInfo.carbohydrates <= 20
                        : false;
                case 'paleo':
                    return !recipe.tags.some(tag => tag === 'grains' ||
                        tag === 'dairy' ||
                        tag === 'processed');
                default:
                    return true;
            }
        });
        if (dietaryMatch) {
            score += weights.dietary;
        }
        return Math.max(0, Math.min(1, score));
    }
    /**
     * Calculate history score
     */
    calculateHistoryScore(recipe, behavior) {
        const now = new Date();
        let score = 0;
        // Calculate view score
        for (const view of behavior.views) {
            if (recipe._id && view.recipeId.equals(recipe._id)) {
                const daysSince = (now.getTime() - view.viewedAt.getTime()) / (1000 * 60 * 60 * 24);
                score += Math.pow(0.5, daysSince / this.config.decay.viewHalfLife);
            }
        }
        // Calculate like/save score
        for (const action of [...behavior.likes, ...behavior.saves]) {
            if (recipe._id && action.recipeId.equals(recipe._id)) {
                const daysSince = (now.getTime() - action.createdAt.getTime()) / (1000 * 60 * 60 * 24);
                score += Math.pow(0.5, daysSince / this.config.decay.saveHalfLife);
            }
        }
        return Math.min(1, score);
    }
    /**
     * Calculate popularity score
     */
    calculatePopularityScore(recipe) {
        const viewScore = Math.min(1, (recipe.stats?.viewCount || 0) / this.config.thresholds.viewThreshold);
        const saveScore = Math.min(1, (recipe.stats?.saveCount || 0) / this.config.thresholds.saveThreshold);
        const ratingScore = recipe.stats?.rating
            ? Math.min(1, recipe.stats.rating / this.config.thresholds.ratingThreshold)
            : recipe.ratings?.average
                ? Math.min(1, recipe.ratings.average / this.config.thresholds.ratingThreshold)
                : 0;
        return (viewScore + saveScore + ratingScore) / 3;
    }
    /**
     * Calculate seasonality score
     */
    calculateSeasonalityScore(recipe) {
        if (!recipe.seasons || recipe.seasons.length === 0)
            return 0.5;
        const currentMonth = new Date().getMonth();
        const seasons = {
            spring: [2, 3, 4],
            summer: [5, 6, 7],
            fall: [8, 9, 10],
            winter: [11, 0, 1],
        };
        for (const [season, months] of Object.entries(seasons)) {
            if (months.includes(currentMonth) && recipe.seasons.includes(season)) {
                return 1;
            }
        }
        return 0;
    }
    /**
     * Calculate difficulty score
     */
    calculateDifficultyScore(recipe, preferences) {
        const difficultyLevels = ['easy', 'medium', 'hard'];
        const preferredIndex = difficultyLevels.indexOf(preferences.preferredDifficulty);
        const recipeIndex = difficultyLevels.indexOf(recipe.difficulty);
        if (preferredIndex === -1 || recipeIndex === -1)
            return 0.5;
        const diff = Math.abs(preferredIndex - recipeIndex);
        return 1 - diff / (difficultyLevels.length - 1);
    }
    /**
     * Calculate timing score
     */
    calculateTimingScore(recipe, preferences) {
        if (!preferences.maxPrepTime && !preferences.maxCookTime)
            return 1;
        const prepScore = preferences.maxPrepTime
            ? Math.max(0, 1 - recipe.prepTime / preferences.maxPrepTime)
            : 1;
        const cookScore = preferences.maxCookTime
            ? Math.max(0, 1 - recipe.cookTime / preferences.maxCookTime)
            : 1;
        return (prepScore + cookScore) / 2;
    }
}
//# sourceMappingURL=recommendation.service.new.js.map
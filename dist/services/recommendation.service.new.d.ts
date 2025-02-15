import { ObjectId } from 'mongodb';
import { DatabaseService } from '../db/database.service.js';
import type { Recipe } from '../types/index.js';
import { RecommendationType, UserBehavior } from '../types/recommendation.js';
export declare class RecommendationService {
    private db;
    private static instance;
    private readonly config;
    private constructor();
    static getInstance(db: DatabaseService): RecommendationService;
    /**
     * Get personalized recommendations
     */
    getPersonalizedRecommendations(userId: ObjectId, options?: {
        cuisine?: string;
        difficulty?: string;
        maxTime?: number;
        excludeIds?: ObjectId[];
        limit?: number;
    }): Promise<Recipe[]>;
    /**
     * Get user behavior
     */
    getUserBehavior(userId: ObjectId): Promise<UserBehavior[]>;
    /**
     * Track recommendation metrics
     */
    trackMetrics(userId: string, type: RecommendationType, action: 'impression' | 'click' | 'save' | 'conversion'): Promise<void>;
    /**
     * Submit feedback for a recommendation
     */
    submitFeedback(userId: string, recipeId: string, type: RecommendationType, action: 'accept' | 'reject' | 'irrelevant', reason?: string): Promise<void>;
    /**
     * Update recommendation scores
     */
    private updateRecommendationScores;
    /**
     * Calculate new score based on feedback
     */
    private calculateNewScore;
    /**
     * Calculate CTR for a recommendation type
     */
    private calculateCTR;
    /**
     * Get user preferences
     */
    private getUserPreference;
    /**
     * Calculate scores for recipes
     */
    private calculateScores;
    /**
     * Calculate preference score
     */
    private calculatePreferenceScore;
    /**
     * Calculate history score
     */
    private calculateHistoryScore;
    /**
     * Calculate popularity score
     */
    private calculatePopularityScore;
    /**
     * Calculate seasonality score
     */
    private calculateSeasonalityScore;
    /**
     * Calculate difficulty score
     */
    private calculateDifficultyScore;
    /**
     * Calculate timing score
     */
    private calculateTimingScore;
}

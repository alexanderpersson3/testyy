import { ObjectId } from 'mongodb';
import { DatabaseService } from '../db/database.service.js';
import type { Recipe } from '../types/index.js';
import type { RecommendationType } from '../types/index.js';
export declare class RecommendationService {
    private static instance;
    private readonly config;
    private readonly db;
    private constructor();
    static getInstance(db: DatabaseService): RecommendationService;
    /**
     * Get recommendations
     */
    getRecommendations(userId: ObjectId, limit?: number): Promise<Recipe[]>;
    /**
     * Get trending recipes
     */
    getTrendingRecipes(options?: {
        timeframe?: 'day' | 'week' | 'month';
        category?: string;
        limit?: number;
    }): Promise<Recipe[]>;
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
}

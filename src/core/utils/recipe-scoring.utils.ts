import type { Recipe } from '../types/recipe.js';
import type { RecommendationContext, MatchFactors } from '../services/recommendation.service.js';
import { ScoringError } from '../services/recommendation.service.js';

/**
 * Utility class for recipe scoring and matching
 */
export class RecipeScoringUtils {
  /**
   * Calculates similarity score between two recipes
   * @param recipe1 - First recipe to compare
   * @param recipe2 - Second recipe to compare
   * @returns Similarity score between 0 and 1
   * @throws {ScoringError} If scoring calculation fails
   */
  static calculateSimilarityScore(recipe1: Recipe, recipe2: Recipe): number {
    try {
      let score = 0;

      // Compare cuisines (30% weight)
      if (recipe1.cuisine && recipe2.cuisine && recipe1.cuisine === recipe2.cuisine) {
        score += 0.3;
      }

      // Compare tags (30% weight)
      const commonTags = recipe1.tags.filter(tag => recipe2.tags.includes(tag));
      score += (commonTags.length / Math.max(recipe1.tags.length, recipe2.tags.length)) * 0.3;

      // Compare difficulty (20% weight)
      if (recipe1.difficulty === recipe2.difficulty) {
        score += 0.2;
      }

      // Compare cooking time (20% weight)
      const time1 = (recipe1.prepTime || 0) + (recipe1.cookTime || 0);
      const time2 = (recipe2.prepTime || 0) + (recipe2.cookTime || 0);
      const timeDiff = Math.abs(time1 - time2);
      score += Math.max(0, 0.2 - (timeDiff / 60) * 0.1);

      return Math.min(1, score);
    } catch (error) {
      throw new ScoringError('Failed to calculate similarity score', error);
    }
  }

  /**
   * Calculates match factors between two recipes
   * @param recipe1 - First recipe to compare
   * @param recipe2 - Second recipe to compare
   * @returns Match factors for different comparison aspects
   * @throws {ScoringError} If factor calculation fails
   */
  static calculateMatchFactors(recipe1: Recipe, recipe2: Recipe): MatchFactors {
    try {
      return {
        preferences: recipe1.cuisine === recipe2.cuisine ? 1 : 0,
        history: 0, // Not applicable for similarity comparison
        popularity: recipe2.ratings?.average || 0,
        seasonality: 0.5, // Default value when not considering season
        difficulty: recipe1.difficulty === recipe2.difficulty ? 1 : 0,
        timing: Math.max(0, 1 - Math.abs(
          ((recipe1.prepTime || 0) + (recipe1.cookTime || 0)) - 
          ((recipe2.prepTime || 0) + (recipe2.cookTime || 0))
        ) / 60)
      };
    } catch (error) {
      throw new ScoringError('Failed to calculate match factors', error);
    }
  }

  /**
   * Calculates context-based score for a recipe
   * @param recipe - Recipe to score
   * @param context - User's recommendation context
   * @returns Context-based score between 0 and 1
   * @throws {ScoringError} If scoring calculation fails
   */
  static calculateContextScore(recipe: Recipe, context: RecommendationContext): number {
    try {
      let score = 0;

      // Preference matching (30% weight)
      if (context.preferences) {
        if (context.preferences.cuisines?.includes(recipe.cuisine || '')) {
          score += 0.3;
        }
        if (context.preferences.difficulty?.includes(recipe.difficulty)) {
          score += 0.2;
        }
        if (context.preferences.maxTime) {
          const totalTime = (recipe.prepTime || 0) + (recipe.cookTime || 0);
          if (totalTime <= context.preferences.maxTime) {
            score += 0.2 * (1 - totalTime / context.preferences.maxTime);
          }
        }
      }

      // Popularity (10% weight)
      if (recipe.ratings?.average) {
        score += Math.min(recipe.ratings.average / 5, 1) * 0.1;
      }

      // Season matching (20% weight)
      if (context.season && recipe.seasons?.includes(context.season)) {
        score += 0.2;
      }

      return Math.min(1, score);
    } catch (error) {
      throw new ScoringError('Failed to calculate context score', error);
    }
  }

  /**
   * Calculates context-based match factors for a recipe
   * @param recipe - Recipe to analyze
   * @param context - User's recommendation context
   * @returns Match factors for different context aspects
   * @throws {ScoringError} If factor calculation fails
   */
  static calculateContextFactors(recipe: Recipe, context: RecommendationContext): MatchFactors {
    try {
      const hasLikedRecipes = context.history?.likedRecipes?.length || 0;
      const isLiked = context.history?.likedRecipes?.includes(recipe._id) || false;

      return {
        preferences: context.preferences?.cuisines?.includes(recipe.cuisine || '') ? 1 : 0,
        history: hasLikedRecipes ? (isLiked ? 1 : 0) : 0.5,
        popularity: Math.min((recipe.ratings?.average || 0) / 5, 1),
        seasonality: context.season && recipe.seasons?.includes(context.season) ? 1 : 0.5,
        difficulty: context.preferences?.difficulty?.includes(recipe.difficulty) ? 1 : 0.5,
        timing: context.preferences?.maxTime
          ? Math.max(0, 1 - ((recipe.prepTime || 0) + (recipe.cookTime || 0)) / context.preferences.maxTime)
          : 0.5
      };
    } catch (error) {
      throw new ScoringError('Failed to calculate context factors', error);
    }
  }
} 
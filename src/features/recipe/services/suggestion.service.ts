import { DatabaseService } from '../db/database.service.js';;
import { levenshteinDistance } from '../utils/string.js';;
import { DatabaseError } from '../utils/errors.js';;
import logger from '../utils/logger.js';

export interface QuerySuggestion {
  originalQuery: string;
  suggestedQuery: string;
  confidence: number;
  popularity: number;
}

export class SuggestionService {
  private static instance: SuggestionService;
  private readonly MIN_CONFIDENCE = 0.7;
  private readonly MAX_SUGGESTIONS = 3;
  private db: DatabaseService;
  private initialized: boolean = false;

  private constructor() {
    this.db = DatabaseService.getInstance();
    this.initialize().catch(error => {
      logger.error('Failed to initialize SuggestionService:', error);
    });
  }

  private async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      await this.db.connect();
      this.initialized = true;
      logger.info('SuggestionService initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize SuggestionService:', error);
      throw error;
    }
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  public static getInstance(): SuggestionService {
    if (!SuggestionService.instance) {
      SuggestionService.instance = new SuggestionService();
    }
    return SuggestionService.instance;
  }

  /**
   * Get suggestions for a search query
   */
  async getSuggestions(query: string): Promise<QuerySuggestion[]> {
    await this.ensureInitialized();

    try {
      // Get popular queries from analytics
      const popularQueries = await this.db.getCollection('popular_queries')
        .find({})
        .sort({ count: -1 })
        .limit(100)
        .toArray();

      // Calculate similarity scores
      const suggestions = popularQueries.map(pq => {
        const distance = levenshteinDistance(query.toLowerCase(), pq.query.toLowerCase());
        const maxLength = Math.max(query.length, pq.query.length);
        const similarity = 1 - distance / maxLength;

        return {
          originalQuery: query,
          suggestedQuery: pq.query,
          confidence: similarity,
          popularity: pq.count,
        };
      });

      // Filter and sort suggestions
      return suggestions
        .filter(s => s.confidence >= this.MIN_CONFIDENCE && s.suggestedQuery !== query)
        .sort((a: any, b: any) => {
          // Weight confidence more heavily than popularity
          const aScore = a.confidence * 0.7 + Math.log10(a.popularity) * 0.3;
          const bScore = b.confidence * 0.7 + Math.log10(b.popularity) * 0.3;
          return bScore - aScore;
        })
        .slice(0, this.MAX_SUGGESTIONS);
    } catch (error) {
      logger.error('Failed to get suggestions:', error);
      throw new DatabaseError('Failed to get suggestions');
    }
  }

  /**
   * Get autocomplete suggestions
   */
  async getAutocompleteSuggestions(partialQuery: string, limit: number = 5): Promise<string[]> {
    await this.ensureInitialized();

    try {
      const suggestions = await this.db.getCollection('popular_queries')
        .find({
          query: {
            $regex: `^${partialQuery}`,
            $options: 'i',
          },
        })
        .sort({ count: -1 })
        .limit(limit)
        .toArray();

      return suggestions.map(s => s.query);
    } catch (error) {
      logger.error('Failed to get autocomplete suggestions:', error);
      throw new DatabaseError('Failed to get autocomplete suggestions');
    }
  }

  /**
   * Get related queries based on user behavior
   */
  async getRelatedQueries(query: string): Promise<Array<{ query: string; popularity: number; }>> {
    await this.ensureInitialized();

    try {
      // Get search sessions containing this query
      const sessions = await this.db.getCollection('search_analytics')
        .find({
          query: query.toLowerCase(),
        })
        .sort({ timestamp: -1 })
        .limit(100)
        .toArray();

      // Get other queries from same sessions
      const userIds = sessions.map(s => s.userId);
      const sessionWindow = 30 * 60 * 1000; // 30 minutes

      const relatedSearches = await this.db.getCollection('search_analytics')
        .aggregate([
          {
            $match: {
              userId: { $in: userIds },
              query: { $ne: query.toLowerCase() },
              timestamp: {
                $gte: new Date(Date.now() - sessionWindow),
              },
            },
          },
          {
            $group: {
              _id: '$query',
              count: { $sum: 1 },
            },
          },
          {
            $sort: { count: -1 },
          },
          {
            $limit: 5,
          },
        ])
        .toArray();

      return relatedSearches.map(rs => ({
        query: rs._id,
        popularity: rs.count,
      }));
    } catch (error) {
      logger.error('Failed to get related queries:', error);
      throw new DatabaseError('Failed to get related queries');
    }
  }

  /**
   * Get trending queries
   */
  async getTrendingQueries(timeWindow: number = 24 * 60 * 60 * 1000): Promise<Array<{
    query: string;
    searchCount: number;
    growth: number;
  }>> {
    await this.ensureInitialized();

    try {
      const now = new Date();
      const periodEnd = now;
      const periodStart = new Date(now.getTime() - timeWindow);
      const previousStart = new Date(periodStart.getTime() - timeWindow);

      // Get current period metrics
      const currentPeriod = await this.db.getCollection('search_analytics')
        .aggregate([
          {
            $match: {
              timestamp: {
                $gte: periodStart,
                $lt: periodEnd,
              },
            },
          },
          {
            $group: {
              _id: '$query',
              searchCount: { $sum: 1 },
            },
          },
        ])
        .toArray();

      // Get previous period metrics
      const previousPeriod = await this.db.getCollection('search_analytics')
        .aggregate([
          {
            $match: {
              timestamp: {
                $gte: previousStart,
                $lt: periodStart,
              },
            },
          },
          {
            $group: {
              _id: '$query',
              previousCount: { $sum: 1 },
            },
          },
        ])
        .toArray();

      const previousCounts = new Map(previousPeriod.map(p => [p._id, p.previousCount]));

      // Calculate growth rates
      const trending = currentPeriod.map(current => {
        const previousCount = previousCounts.get(current._id) || 0;
        const growth =
          previousCount === 0 ? 100 : ((current.searchCount - previousCount) / previousCount) * 100;

        return {
          query: current._id,
          searchCount: current.searchCount,
          growth,
        };
      });

      // Sort by growth rate and return top 10
      return trending.sort((a: any, b: any) => b.growth - a.growth).slice(0, 10);
    } catch (error) {
      logger.error('Failed to get trending queries:', error);
      throw new DatabaseError('Failed to get trending queries');
    }
  }
}

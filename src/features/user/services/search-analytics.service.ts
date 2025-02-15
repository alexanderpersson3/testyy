import { connectToDatabase } from '../db.js';;

interface SearchEvent {
  _id?: ObjectId;
  userId?: ObjectId;
  query: string;
  filters?: Record<string, any>;
  resultCount: number;
  executionTimeMs: number;
  timestamp: Date;
  sessionId: string;
}

interface SearchAnalytics {
  totalSearches: number;
  uniqueUsers: number;
  averageResultCount: number;
  averageExecutionTime: number;
  popularQueries: Array<{
    query: string;
    count: number;
  }>;
  popularFilters: Array<{
    filter: string;
    count: number;
  }>;
  noResultQueries: Array<{
    query: string;
    count: number;
  }>;
}

export class SearchAnalyticsService {
  private static instance: SearchAnalyticsService;

  private constructor() {}

  static getInstance(): SearchAnalyticsService {
    if (!SearchAnalyticsService.instance) {
      SearchAnalyticsService.instance = new SearchAnalyticsService();
    }
    return SearchAnalyticsService.instance;
  }

  /**
   * Log a search event
   */
  async logSearchEvent(event: Omit<SearchEvent, '_id' | 'timestamp'>): Promise<void> {
    const db = await connectToDatabase();

    const searchEvent: SearchEvent = {
      ...event,
      timestamp: new Date(),
    };

    await db.collection<SearchEvent>('search_events').insertOne(searchEvent);
  }

  /**
   * Get analytics for a time period
   */
  async getAnalytics(startDate: Date, endDate: Date): Promise<SearchAnalytics> {
    const db = await connectToDatabase();

    const pipeline = [
      {
        $match: {
          timestamp: {
            $gte: startDate,
            $lte: endDate,
          },
        },
      },
      {
        $facet: {
          totalSearches: [{ $count: 'count' }],
          uniqueUsers: [{ $group: { _id: '$userId' } }, { $count: 'count' }],
          averages: [
            {
              $group: {
                _id: null,
                avgResults: { $avg: '$resultCount' },
                avgTime: { $avg: '$executionTimeMs' },
              },
            },
          ],
          popularQueries: [
            { $group: { _id: '$query', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 10 },
          ],
          popularFilters: [
            { $unwind: '$filters' },
            { $group: { _id: '$filters', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 10 },
          ],
          noResults: [
            { $match: { resultCount: 0 } },
            { $group: { _id: '$query', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 10 },
          ],
        },
      },
    ];

    const [result] = await db
      .collection<SearchEvent>('search_events')
      .aggregate(pipeline)
      .toArray();

    return {
      totalSearches: result.totalSearches[0]?.count || 0,
      uniqueUsers: result.uniqueUsers[0]?.count || 0,
      averageResultCount: result.averages[0]?.avgResults || 0,
      averageExecutionTime: result.averages[0]?.avgTime || 0,
      popularQueries: result.popularQueries.map((q: { _id: string; count: number }) => ({
        query: q._id,
        count: q.count,
      })),
      popularFilters: result.popularFilters.map((f: { _id: string; count: number }) => ({
        filter: f._id,
        count: f.count,
      })),
      noResultQueries: result.noResults.map((q: { _id: string; count: number }) => ({
        query: q._id,
        count: q.count,
      })),
    };
  }

  /**
   * Get search suggestions based on popular queries
   */
  async getSearchSuggestions(partialQuery: string, limit = 5): Promise<string[]> {
    const db = await connectToDatabase();

    const pipeline = [
      {
        $match: {
          query: {
            $regex: `^${partialQuery}`,
            $options: 'i',
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
        $limit: limit,
      },
    ];

    const suggestions = await db
      .collection<SearchEvent>('search_events')
      .aggregate(pipeline)
      .toArray();

    return suggestions.map(s => s._id);
  }

  /**
   * Get performance metrics
   */
  async getPerformanceMetrics(
    startDate: Date,
    endDate: Date
  ): Promise<{
    p50: number;
    p90: number;
    p99: number;
  }> {
    const db = await connectToDatabase();

    const pipeline = [
      {
        $match: {
          timestamp: {
            $gte: startDate,
            $lte: endDate,
          },
        },
      },
      {
        $sort: { executionTimeMs: 1 },
      },
      {
        $group: {
          _id: null,
          times: { $push: '$executionTimeMs' },
          count: { $sum: 1 },
        },
      },
      {
        $project: {
          p50: { $arrayElemAt: ['$times', { $floor: { $multiply: [0.5, '$count'] } }] },
          p90: { $arrayElemAt: ['$times', { $floor: { $multiply: [0.9, '$count'] } }] },
          p99: { $arrayElemAt: ['$times', { $floor: { $multiply: [0.99, '$count'] } }] },
        },
      },
    ];

    const [result] = await db
      .collection<SearchEvent>('search_events')
      .aggregate(pipeline)
      .toArray();

    return {
      p50: result?.p50 || 0,
      p90: result?.p90 || 0,
      p99: result?.p99 || 0,
    };
  }
}

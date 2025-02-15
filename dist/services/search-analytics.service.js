import { connectToDatabase } from '../db.js';
export class SearchAnalyticsService {
    constructor() { }
    static getInstance() {
        if (!SearchAnalyticsService.instance) {
            SearchAnalyticsService.instance = new SearchAnalyticsService();
        }
        return SearchAnalyticsService.instance;
    }
    /**
     * Log a search event
     */
    async logSearchEvent(event) {
        const db = await connectToDatabase();
        const searchEvent = {
            ...event,
            timestamp: new Date(),
        };
        await db.collection('search_events').insertOne(searchEvent);
    }
    /**
     * Get analytics for a time period
     */
    async getAnalytics(startDate, endDate) {
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
            .collection('search_events')
            .aggregate(pipeline)
            .toArray();
        return {
            totalSearches: result.totalSearches[0]?.count || 0,
            uniqueUsers: result.uniqueUsers[0]?.count || 0,
            averageResultCount: result.averages[0]?.avgResults || 0,
            averageExecutionTime: result.averages[0]?.avgTime || 0,
            popularQueries: result.popularQueries.map((q) => ({
                query: q._id,
                count: q.count,
            })),
            popularFilters: result.popularFilters.map((f) => ({
                filter: f._id,
                count: f.count,
            })),
            noResultQueries: result.noResults.map((q) => ({
                query: q._id,
                count: q.count,
            })),
        };
    }
    /**
     * Get search suggestions based on popular queries
     */
    async getSearchSuggestions(partialQuery, limit = 5) {
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
            .collection('search_events')
            .aggregate(pipeline)
            .toArray();
        return suggestions.map(s => s._id);
    }
    /**
     * Get performance metrics
     */
    async getPerformanceMetrics(startDate, endDate) {
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
            .collection('search_events')
            .aggregate(pipeline)
            .toArray();
        return {
            p50: result?.p50 || 0,
            p90: result?.p90 || 0,
            p99: result?.p99 || 0,
        };
    }
}
//# sourceMappingURL=search-analytics.service.js.map
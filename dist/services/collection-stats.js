import { connectToDatabase } from '../db/db.js';
async function getActivityTrends(db, collectionId, timeframe) {
    const trends = await db.collection('collection_activities').aggregate([
        {
            $match: {
                collectionId,
                createdAt: {
                    $gte: new Date(Date.now() - timeframe.periods * 24 * 60 * 60 * 1000)
                }
            }
        },
        {
            $group: {
                _id: {
                    $dateToString: {
                        format: timeframe.format,
                        date: '$createdAt'
                    }
                },
                count: { $sum: 1 }
            }
        },
        { $sort: { '_id': 1 } }
    ]).toArray();
    // Calculate trends
    return trends.map((current, index) => {
        const previous = index > 0 ? trends[index - 1].count : current.count;
        const change = previous === 0 ? 0 : ((current.count - previous) / previous) * 100;
        return {
            period: current._id,
            count: current.count,
            change: Math.round(change * 100) / 100 // Round to 2 decimal places
        };
    });
}
async function getActivityHeatmap(db, collectionId) {
    const hourlyData = await db.collection('collection_activities').aggregate([
        {
            $match: {
                collectionId,
                createdAt: {
                    $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
                }
            }
        },
        {
            $group: {
                _id: {
                    hour: { $hour: '$createdAt' },
                    day: { $dayOfWeek: '$createdAt' },
                    type: '$type'
                },
                count: { $sum: 1 }
            }
        }
    ]).toArray();
    // Initialize arrays for all hours and days
    const hourlyStats = new Array(24).fill(null).map((_, hour) => ({
        hour,
        count: 0,
        intensity: 0,
        byType: []
    }));
    const dailyStats = new Array(7).fill(null).map((_, day) => ({
        day,
        count: 0,
        intensity: 0,
        byType: [],
        hourly: new Array(24).fill(null).map((_, hour) => ({
            hour,
            count: 0,
            intensity: 0,
            byType: []
        }))
    }));
    // Track maximum counts for normalization
    const maxCounts = {
        hourly: { total: 0, byType: new Map() },
        daily: { total: 0, byType: new Map() },
        dayHour: { total: 0, byType: new Map() }
    };
    // Process the data
    hourlyData.forEach((data) => {
        const hour = data._id.hour;
        const day = data._id.day - 1;
        const type = data._id.type;
        const count = data.count;
        // Update hourly stats
        hourlyStats[hour].count += count;
        maxCounts.hourly.total = Math.max(maxCounts.hourly.total, hourlyStats[hour].count);
        let hourTypeStats = hourlyStats[hour].byType.find(t => t.type === type);
        if (!hourTypeStats) {
            hourTypeStats = { type, count: 0, intensity: 0 };
            hourlyStats[hour].byType.push(hourTypeStats);
        }
        hourTypeStats.count += count;
        maxCounts.hourly.byType.set(type, Math.max(maxCounts.hourly.byType.get(type) || 0, hourTypeStats.count));
        // Update daily stats
        dailyStats[day].count += count;
        maxCounts.daily.total = Math.max(maxCounts.daily.total, dailyStats[day].count);
        let dayTypeStats = dailyStats[day].byType.find(t => t.type === type);
        if (!dayTypeStats) {
            dayTypeStats = { type, count: 0, intensity: 0 };
            dailyStats[day].byType.push(dayTypeStats);
        }
        dayTypeStats.count += count;
        maxCounts.daily.byType.set(type, Math.max(maxCounts.daily.byType.get(type) || 0, dayTypeStats.count));
        // Update day-hour stats
        dailyStats[day].hourly[hour].count += count;
        maxCounts.dayHour.total = Math.max(maxCounts.dayHour.total, dailyStats[day].hourly[hour].count);
        let dayHourTypeStats = dailyStats[day].hourly[hour].byType.find(t => t.type === type);
        if (!dayHourTypeStats) {
            dayHourTypeStats = { type, count: 0, intensity: 0 };
            dailyStats[day].hourly[hour].byType.push(dayHourTypeStats);
        }
        dayHourTypeStats.count += count;
        maxCounts.dayHour.byType.set(type, Math.max(maxCounts.dayHour.byType.get(type) || 0, dayHourTypeStats.count));
    });
    // Calculate intensities
    hourlyStats.forEach(stat => {
        stat.intensity = maxCounts.hourly.total > 0 ? stat.count / maxCounts.hourly.total : 0;
        stat.byType.forEach(typeStat => {
            const maxTypeCount = maxCounts.hourly.byType.get(typeStat.type) || 0;
            typeStat.intensity = maxTypeCount > 0 ? typeStat.count / maxTypeCount : 0;
        });
    });
    dailyStats.forEach(stat => {
        stat.intensity = maxCounts.daily.total > 0 ? stat.count / maxCounts.daily.total : 0;
        stat.byType.forEach(typeStat => {
            const maxTypeCount = maxCounts.daily.byType.get(typeStat.type) || 0;
            typeStat.intensity = maxTypeCount > 0 ? typeStat.count / maxTypeCount : 0;
        });
        stat.hourly.forEach(hourStat => {
            hourStat.intensity = maxCounts.dayHour.total > 0 ? hourStat.count / maxCounts.dayHour.total : 0;
            hourStat.byType.forEach(typeStat => {
                const maxTypeCount = maxCounts.dayHour.byType.get(typeStat.type) || 0;
                typeStat.intensity = maxTypeCount > 0 ? typeStat.count / maxTypeCount : 0;
            });
        });
    });
    return {
        hourly: hourlyStats,
        daily: dailyStats
    };
}
function findPeakTimes(heatmap) {
    let mostActiveHour = 0;
    let quietestHour = 0;
    let mostActiveDay = 0;
    let quietestDay = 0;
    // Find peak and quiet hours
    heatmap.hourly.forEach((stat, hour) => {
        if (stat.count > heatmap.hourly[mostActiveHour].count) {
            mostActiveHour = hour;
        }
        if (stat.count < heatmap.hourly[quietestHour].count) {
            quietestHour = hour;
        }
    });
    // Find peak and quiet days
    heatmap.daily.forEach((stat, day) => {
        if (stat.count > heatmap.daily[mostActiveDay].count) {
            mostActiveDay = day;
        }
        if (stat.count < heatmap.daily[quietestDay].count) {
            quietestDay = day;
        }
    });
    return {
        mostActiveHour,
        quietestHour,
        mostActiveDay,
        quietestDay
    };
}
export async function getCollectionStats(collectionId) {
    const db = await connectToDatabase();
    const now = new Date();
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    // Get collection details with history
    const collection = await db.collection('recipe_collections').aggregate([
        { $match: { _id: collectionId } },
        {
            $lookup: {
                from: 'collection_activities',
                let: { collId: '$_id' },
                pipeline: [
                    {
                        $match: {
                            $expr: { $eq: ['$collectionId', '$$collId'] },
                            type: { $in: ['recipe_added', 'recipe_removed'] },
                            createdAt: { $gte: monthAgo }
                        }
                    },
                    { $sort: { createdAt: 1 } }
                ],
                as: 'recipeHistory'
            }
        }
    ]).toArray();
    if (!collection.length) {
        throw new Error('Collection not found');
    }
    const [collectionData] = collection;
    // Calculate growth trends
    const recipeGrowth = calculateGrowthTrend(collectionData.recipeHistory);
    const collaboratorGrowth = calculateCollaboratorGrowth(collectionData);
    // Get activity trends
    const [lastDayCount, lastWeekCount, lastMonthCount, dailyTrends, weeklyTrends, monthlyTrends, activityByType, topContributors, recipeActivities, collaboratorStats] = await Promise.all([
        db.collection('collection_activities').countDocuments({
            collectionId,
            createdAt: { $gte: dayAgo }
        }),
        db.collection('collection_activities').countDocuments({
            collectionId,
            createdAt: { $gte: weekAgo }
        }),
        db.collection('collection_activities').countDocuments({
            collectionId,
            createdAt: { $gte: monthAgo }
        }),
        getActivityTrends(db, collectionId, {
            unit: 'day',
            format: '%Y-%m-%d',
            periods: 7
        }),
        getActivityTrends(db, collectionId, {
            unit: 'week',
            format: '%Y-W%V',
            periods: 4
        }),
        getActivityTrends(db, collectionId, {
            unit: 'month',
            format: '%Y-%m',
            periods: 3
        }),
        db.collection('collection_activities').aggregate([
            { $match: { collectionId } },
            {
                $group: {
                    _id: '$type',
                    count: { $sum: 1 }
                }
            },
            {
                $project: {
                    _id: 0,
                    type: '$_id',
                    count: 1
                }
            }
        ]).toArray(),
        db.collection('collection_activities').aggregate([
            { $match: { collectionId } },
            {
                $group: {
                    _id: '$userId',
                    activityCount: { $sum: 1 }
                }
            },
            {
                $lookup: {
                    from: 'users',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'user'
                }
            },
            { $unwind: '$user' },
            {
                $project: {
                    userId: '$_id',
                    name: '$user.name',
                    email: '$user.email',
                    activityCount: 1
                }
            },
            { $sort: { activityCount: -1 } },
            { $limit: 5 }
        ]).toArray(),
        db.collection('collection_activities').aggregate([
            {
                $match: {
                    collectionId,
                    type: { $in: ['recipe_added', 'recipe_removed'] }
                }
            },
            {
                $facet: {
                    counts: [
                        {
                            $group: {
                                _id: '$type',
                                count: { $sum: 1 }
                            }
                        }
                    ],
                    mostAdded: [
                        {
                            $match: { type: 'recipe_added' }
                        },
                        {
                            $group: {
                                _id: '$details.recipeId',
                                title: { $first: '$details.recipeTitle' },
                                count: { $sum: 1 }
                            }
                        },
                        { $sort: { count: -1 } },
                        { $limit: 3 }
                    ]
                }
            }
        ]).toArray(),
        db.collection('collection_activities').aggregate([
            {
                $match: {
                    collectionId,
                    type: {
                        $in: [
                            'collaborator_added',
                            'collaborator_removed',
                            'collaborator_updated'
                        ]
                    }
                }
            },
            {
                $facet: {
                    counts: [
                        {
                            $group: {
                                _id: '$type',
                                count: { $sum: 1 }
                            }
                        }
                    ],
                    roles: [
                        {
                            $match: {
                                type: 'collaborator_added'
                            }
                        },
                        {
                            $group: {
                                _id: '$details.role',
                                count: { $sum: 1 }
                            }
                        }
                    ]
                }
            }
        ]).toArray()
    ]);
    const [recipeStats] = recipeActivities;
    const [collaboratorData] = collaboratorStats;
    // Get activity heatmap
    const heatmap = await getActivityHeatmap(db, collectionId);
    const peakTimes = findPeakTimes(heatmap);
    return {
        totalRecipes: collectionData.recipeIds.length,
        totalCollaborators: collectionData.collaborators?.length || 0,
        activitySummary: {
            lastDay: lastDayCount,
            lastWeek: lastWeekCount,
            lastMonth: lastMonthCount
        },
        trends: {
            daily: dailyTrends,
            weekly: weeklyTrends,
            monthly: monthlyTrends,
            recipeGrowth,
            collaboratorGrowth
        },
        topContributors: topContributors,
        activityByType: activityByType,
        recipeStats: {
            addedCount: recipeStats.counts.find((c) => c._id === 'recipe_added')?.count || 0,
            removedCount: recipeStats.counts.find((c) => c._id === 'recipe_removed')?.count || 0,
            mostAdded: recipeStats.mostAdded.map((r) => ({
                recipeId: r._id,
                title: r.title,
                count: r.count
            }))
        },
        collaboratorStats: {
            addedCount: collaboratorData.counts.find((c) => c._id === 'collaborator_added')?.count || 0,
            removedCount: collaboratorData.counts.find((c) => c._id === 'collaborator_removed')?.count || 0,
            roleChanges: collaboratorData.counts.find((c) => c._id === 'collaborator_updated')?.count || 0,
            byRole: collaboratorData.roles.map((r) => ({
                role: r._id,
                count: r.count
            }))
        },
        activityPatterns: {
            heatmap,
            peakTimes,
            timeZoneOffset: new Date().getTimezoneOffset()
        }
    };
}
function calculateGrowthTrend(recipeHistory) {
    const changes = recipeHistory.reduce((acc, activity) => {
        if (activity.type === 'recipe_added')
            acc++;
        if (activity.type === 'recipe_removed')
            acc--;
        return acc;
    }, 0);
    const trend = recipeHistory.length > 0
        ? (changes / recipeHistory.length) * 100
        : 0;
    return {
        count: changes,
        trend: Math.round(trend * 100) / 100
    };
}
function calculateCollaboratorGrowth(collection) {
    const currentCount = collection.collaborators?.length || 0;
    const addedCount = collection.recipeHistory
        .filter((a) => a.type === 'collaborator_added')
        .length;
    const removedCount = collection.recipeHistory
        .filter((a) => a.type === 'collaborator_removed')
        .length;
    const trend = addedCount + removedCount > 0
        ? ((addedCount - removedCount) / (addedCount + removedCount)) * 100
        : 0;
    return {
        count: currentCount,
        trend: Math.round(trend * 100) / 100
    };
}
export function getCollectionStatsService() {
    return {
        getCollectionStats
    };
}
//# sourceMappingURL=collection-stats.js.map
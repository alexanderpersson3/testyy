import { ObjectId } from 'mongodb';
import { CollectionActivity } from './collection-activity.js';
interface ActivityTrend {
    period: string;
    count: number;
    change: number;
}
interface TypedActivityStats {
    type: CollectionActivity['type'];
    count: number;
    intensity: number;
}
interface ActivityHeatmap {
    hourly: {
        hour: number;
        count: number;
        intensity: number;
        byType: TypedActivityStats[];
    }[];
    daily: {
        day: number;
        count: number;
        intensity: number;
        hourly: {
            hour: number;
            count: number;
            intensity: number;
            byType: TypedActivityStats[];
        }[];
        byType: TypedActivityStats[];
    }[];
}
interface CollectionStats {
    totalRecipes: number;
    totalCollaborators: number;
    activitySummary: {
        lastDay: number;
        lastWeek: number;
        lastMonth: number;
    };
    trends: {
        daily: ActivityTrend[];
        weekly: ActivityTrend[];
        monthly: ActivityTrend[];
        recipeGrowth: {
            count: number;
            trend: number;
        };
        collaboratorGrowth: {
            count: number;
            trend: number;
        };
    };
    topContributors: {
        userId: ObjectId;
        name: string;
        email: string;
        activityCount: number;
    }[];
    activityByType: {
        type: CollectionActivity['type'];
        count: number;
    }[];
    recipeStats: {
        addedCount: number;
        removedCount: number;
        mostAdded: {
            recipeId: ObjectId;
            title: string;
            count: number;
        }[];
    };
    collaboratorStats: {
        addedCount: number;
        removedCount: number;
        roleChanges: number;
        byRole: {
            role: 'viewer' | 'editor';
            count: number;
        }[];
    };
    activityPatterns: {
        heatmap: ActivityHeatmap;
        peakTimes: {
            mostActiveHour: number;
            mostActiveDay: number;
            quietestHour: number;
            quietestDay: number;
        };
        timeZoneOffset: number;
    };
}
export declare function getCollectionStats(collectionId: ObjectId): Promise<CollectionStats>;
export declare function getCollectionStatsService(): {
    getCollectionStats: typeof getCollectionStats;
};
export {};
//# sourceMappingURL=collection-stats.d.ts.map
export interface LeaderboardOptions {
    limit?: number;
    offset?: number;
}
export interface UserBadge {
    type: string;
    level: number;
    earnedAt: Date;
}
export interface LeaderboardEntry {
    userId: string;
    username: string;
    score: number;
    rank: number;
}
export interface UserRank {
    currentRank: number;
    totalUsers: number;
    score: number;
    nextRank?: {
        score: number;
        remaining: number;
    };
}
declare class AchievementManager {
    private redis;
    private readonly CACHE_TTL;
    private readonly badges;
    initialize(): Promise<void>;
    constructor();
    getLeaderboard(metric: string, options?: LeaderboardOptions): Promise<LeaderboardEntry[]>;
    getUserBadges(userId: string): Promise<UserBadge[]>;
    getUserRank(userId: string, metric: string): Promise<UserRank>;
    trackAchievement(userId: string, achievementType: string, value: number): Promise<{
        badges: UserBadge[];
        newBadges: UserBadge[];
    }>;
}
declare const _default: AchievementManager;
export default _default;
//# sourceMappingURL=achievement-manager.d.ts.map
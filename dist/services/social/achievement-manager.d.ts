import { Achievement } from '../../types/social.js';
import { User } from '../../types/user.js';
export declare class AchievementManager {
    private static instance;
    private db;
    private constructor();
    static getInstance(): AchievementManager;
    getAchievements(): Promise<Achievement[]>;
    getUserAchievements(userId: string): Promise<Achievement[]>;
    getLeaderboard(limit?: number): Promise<Array<{
        user: User;
        achievements: number;
    }>>;
    getUserRank(userId: string): Promise<{
        rank: number;
        percentile: number;
        nextScore?: number;
    }>;
    updateAchievementProgress(userId: string, achievementId: string, progress: number): Promise<void>;
    unlockAchievement(userId: string, achievement: Achievement): Promise<void>;
}
export declare const achievementManager: AchievementManager;

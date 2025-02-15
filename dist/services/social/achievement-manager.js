import { DatabaseService } from '../../db/database.service.js';
import { Achievement, AchievementProgress, UserProfile } from '../../types/social.js';
import { User } from '../../types/user.js';
export class AchievementManager {
    constructor() {
        this.db = DatabaseService.getInstance();
    }
    static getInstance() {
        if (!AchievementManager.instance) {
            AchievementManager.instance = new AchievementManager();
        }
        return AchievementManager.instance;
    }
    async getAchievements() {
        return this.db.getCollection('achievements').find().toArray();
    }
    async getUserAchievements(userId) {
        return this.db
            .getCollection('user_achievements')
            .find({ userId: new ObjectId(userId) })
            .toArray();
    }
    async getLeaderboard(limit = 10) {
        const users = await this.db.getCollection('users').find().toArray();
        return users.map((user) => ({
            user,
            achievements: 0, // You'll need to implement the actual achievement count logic
        }));
    }
    async getUserRank(userId) {
        const user = await this.db.getCollection('users').findOne({
            _id: new ObjectId(userId),
        });
        if (!user) {
            throw new Error('User not found');
        }
        const userScore = user.achievements?.score || 0;
        const totalUsers = await this.db.getCollection('users').countDocuments();
        const higherScores = await this.db.getCollection('users').countDocuments({
            'achievements.score': { $gt: userScore },
        });
        const rank = higherScores + 1;
        const percentile = ((totalUsers - higherScores) / totalUsers) * 100;
        const nextScore = await this.db
            .getCollection('users')
            .findOne({ 'achievements.score': { $gt: userScore } }, { sort: { 'achievements.score': 1 }, projection: { 'achievements.score': 1 } });
        return {
            rank,
            percentile,
            nextScore: nextScore?.achievements?.score,
        };
    }
    async updateAchievementProgress(userId, achievementId, progress) {
        await this.db.getCollection('users').updateOne({ _id: new ObjectId(userId) }, {
            $set: {
                [`achievements.progress.${achievementId}.progress`]: progress,
                updatedAt: new Date(),
            },
        });
    }
    async unlockAchievement(userId, achievement) {
        const user = await this.db.getCollection('users').findOne({
            _id: new ObjectId(userId),
        });
        if (!user) {
            throw new Error('User not found');
        }
        const currentProgress = user.achievements?.progress?.[achievement.id] || {
            progress: 0,
            unlocked: false,
        };
        if (currentProgress.unlocked) {
            return;
        }
        await this.db.getCollection('users').updateOne({ _id: new ObjectId(userId) }, {
            $set: {
                [`achievements.progress.${achievement.id}`]: {
                    progress: achievement.target,
                    unlocked: true,
                    unlockedAt: new Date(),
                },
                'achievements.score': (user.achievements?.score || 0) + achievement.points,
                updatedAt: new Date(),
            },
        });
    }
}
export const achievementManager = AchievementManager.getInstance();
//# sourceMappingURL=achievement-manager.js.map
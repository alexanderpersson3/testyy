import { ObjectId } from 'mongodb';
;
import { DatabaseService } from '../../db/database.service.js';
import { Challenge, ChallengeType, ChallengeStatus, BaseUserChallenge } from '../../types/achievement.js';
import { SeasonalChallenge, SeasonalChallengeBase, ChallengeParticipant } from '../../types/social.js';
export class SeasonalChallengeService {
    constructor() {
        this.SEASON_DURATIONS = {
            spring: { months: [2, 3, 4] },
            summer: { months: [5, 6, 7] },
            autumn: { months: [8, 9, 10] },
            winter: { months: [11, 0, 1] },
        };
        this.db = DatabaseService.getInstance();
    }
    async createChallenge(newChallenge) {
        try {
            const now = new Date();
            const doc = {
                ...newChallenge,
                completionRate: 0,
                participantCount: 0,
                createdAt: new Date(),
                updatedAt: new Date(),
            };
            const result = await this.db.getCollection('seasonal_challenges').insertOne(doc);
            return { ...doc, _id: result.insertedId };
        }
        catch (error) {
            throw new Error(`Failed to create challenge: ${error}`);
        }
    }
    async getAllChallenges() {
        try {
            const challenges = await this.db
                .getCollection('seasonal_challenges')
                .find({})
                .toArray();
            return challenges;
        }
        catch (error) {
            throw new Error(`Failed to get challenges: ${error}`);
        }
    }
    async getChallenge(challengeId) {
        try {
            const challenge = await this.db
                .getCollection('seasonal_challenges')
                .findOne({
                _id: new ObjectId(challengeId),
            });
            return challenge;
        }
        catch (error) {
            throw new Error(`Failed to get challenge: ${error}`);
        }
    }
    async participateInChallenge(challengeId, userId, participation) {
        try {
            const now = new Date();
            const fullParticipation = {
                ...participation,
                _id: new ObjectId(),
                challengeId: new ObjectId(challengeId),
                userId: new ObjectId(userId),
                progress: 0,
                points: 0,
                status: 'active',
                createdAt: now,
                updatedAt: now
            };
            await this.db
                .getCollection('challenge_participants')
                .insertOne(fullParticipation);
            await this.db
                .getCollection('seasonal_challenges')
                .updateOne({ _id: new ObjectId(challengeId) }, { $inc: { participantCount: 1 } });
        }
        catch (error) {
            throw new Error(`Failed to participate in challenge: ${error}`);
        }
    }
    async updateParticipation(challengeId, userId, updates) {
        try {
            await this.db
                .getCollection('challenge_participants')
                .updateOne({ challengeId: new ObjectId(challengeId), userId: new ObjectId(userId) }, { $set: updates });
        }
        catch (error) {
            throw new Error(`Failed to update participation: ${error}`);
        }
    }
    async getLeaderboard(challengeId) {
        try {
            const stats = await this.db
                .getCollection('challenge_participants')
                .aggregate([
                { $match: { challengeId: new ObjectId(challengeId) } },
                {
                    $lookup: {
                        from: 'users',
                        localField: 'userId',
                        foreignField: '_id',
                        as: 'user',
                    },
                },
                { $unwind: '$user' },
                {
                    $project: {
                        _id: 0,
                        userId: 1,
                        points: 1,
                        progress: 1,
                        username: '$user.username',
                        avatar: '$user.avatar',
                    },
                },
                { $sort: { points: -1 } },
            ])
                .toArray();
            return stats;
        }
        catch (error) {
            throw new Error(`Failed to get leaderboard: ${error}`);
        }
    }
    async completeChallenge(userId, challengeId) {
        try {
            const now = new Date();
            await this.db.getCollection('challenge_progress').updateOne({
                userId: new ObjectId(userId),
                challengeId: new ObjectId(challengeId),
            }, {
                $set: {
                    status: 'completed',
                    completedAt: now,
                    updatedAt: now,
                },
            });
            await this.updateCompletionRate(challengeId);
        }
        catch (error) {
            throw new Error(`Failed to complete challenge: ${error}`);
        }
    }
    async getActiveSeasonalChallenges() {
        try {
            const now = new Date();
            const challenges = await this.db
                .getCollection('seasonal_challenges')
                .find({
                startDate: { $lte: now },
                endDate: { $gt: now },
            })
                .sort({ endDate: 1 })
                .toArray();
            return challenges;
        }
        catch (error) {
            console.error('Error getting active seasonal challenges:', error);
            throw error;
        }
    }
    async joinChallenge(userId, challengeId) {
        try {
            const now = new Date();
            const challenge = await this.db
                .getCollection('seasonal_challenges')
                .findOne({
                _id: new ObjectId(challengeId),
                startDate: { $lte: now },
                endDate: { $gt: now },
            });
            if (!challenge) {
                throw new Error('Challenge not found or not active');
            }
            const participation = {
                _id: new ObjectId(),
                userId: new ObjectId(userId),
                challengeId: new ObjectId(challengeId),
                status: 'active',
                progress: 0,
                points: 0,
                createdAt: now,
                updatedAt: now,
            };
            await this.db
                .getCollection('challenge_participants')
                .insertOne(participation);
            await this.db
                .getCollection('seasonal_challenges')
                .updateOne({ _id: new ObjectId(challengeId) }, { $inc: { participantCount: 1 } });
            return true;
        }
        catch (error) {
            console.error('Error joining challenge:', error);
            throw error;
        }
    }
    async updateProgress(userId, challengeId, progress) {
        try {
            const now = new Date();
            const doc = {
                userId: new ObjectId(userId),
                challengeId: new ObjectId(challengeId),
                progress,
                lastUpdated: now,
                status: progress >= 100 ? 'completed' : 'active',
                history: [],
                createdAt: now,
                updatedAt: now
            };
            await this.db.getCollection('challenge_progress').updateOne({
                userId: new ObjectId(userId),
                challengeId: new ObjectId(challengeId),
            }, { $set: doc }, { upsert: true });
        }
        catch (error) {
            console.error('Error updating challenge progress:', error);
            throw error;
        }
    }
    async updateCompletionRate(challengeId) {
        try {
            const stats = await this.db
                .getCollection('challenge_participants')
                .aggregate([
                {
                    $match: {
                        challengeId: new ObjectId(challengeId),
                    },
                },
                {
                    $group: {
                        _id: null,
                        totalParticipants: { $sum: 1 },
                        completedParticipants: {
                            $sum: {
                                $cond: [{ $eq: ['$status', 'completed'] }, 1, 0],
                            },
                        },
                    },
                },
            ])
                .next();
            if (stats) {
                const completionRate = (stats.completedParticipants / stats.totalParticipants) * 100;
                await this.db
                    .getCollection('seasonal_challenges')
                    .updateOne({ _id: new ObjectId(challengeId) }, { $set: { completionRate } });
            }
        }
        catch (error) {
            console.error('Error updating completion rate:', error);
            throw error;
        }
    }
    async getCurrentSeason() {
        const now = new Date();
        const month = now.getMonth();
        for (const [season, data] of Object.entries(this.SEASON_DURATIONS)) {
            if (data.months.includes(month)) {
                return season;
            }
        }
        return 'winter'; // Default to winter if something goes wrong
    }
    async getCurrentChallenges() {
        const now = new Date();
        return this.db
            .getCollection('seasonal_challenges')
            .find({
            startDate: { $lte: now },
            endDate: { $gte: now },
        })
            .toArray();
    }
    async getChallengeProgress(userId, challengeId) {
        return this.db.getCollection('challenge_progress').findOne({
            userId: new ObjectId(userId),
            challengeId: new ObjectId(challengeId),
        });
    }
}
//# sourceMappingURL=seasonal-challenges.js.map
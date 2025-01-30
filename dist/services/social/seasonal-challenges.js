import { ObjectId } from 'mongodb';
import { getDb } from '../../config/db';
export class SeasonalChallengeService {
    constructor() {
        this.SEASON_DURATIONS = {
            spring: { months: [2, 3, 4] },
            summer: { months: [5, 6, 7] },
            autumn: { months: [8, 9, 10] },
            winter: { months: [11, 0, 1] },
        };
    }
    async createSeasonalChallenge(challenge) {
        try {
            const db = await getDb();
            const newChallenge = {
                ...challenge,
                participantCount: 0,
                completionRate: 0,
                createdAt: new Date(),
                updatedAt: new Date()
            };
            const result = await db.collection('seasonal_challenges').insertOne(newChallenge);
            return result.insertedId;
        }
        catch (error) {
            console.error('Error creating seasonal challenge:', error);
            throw error;
        }
    }
    async getActiveSeasonalChallenges() {
        try {
            const db = await getDb();
            const now = new Date();
            const challenges = await db.collection('seasonal_challenges')
                .find({
                startDate: { $lte: now },
                endDate: { $gt: now }
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
            const db = await getDb();
            const now = new Date();
            const challenge = await db.collection('seasonal_challenges').findOne({
                _id: new ObjectId(challengeId),
                startDate: { $lte: now },
                endDate: { $gt: now }
            });
            if (!challenge) {
                throw new Error('Challenge not found or not active');
            }
            const participation = {
                userId: new ObjectId(userId),
                challengeId: new ObjectId(challengeId),
                status: 'active',
                progress: 0,
                joinedAt: now,
                lastUpdated: now
            };
            await db.collection('challenge_participants').insertOne(participation);
            await db.collection('seasonal_challenges').updateOne({ _id: new ObjectId(challengeId) }, { $inc: { participantCount: 1 } });
            return true;
        }
        catch (error) {
            console.error('Error joining challenge:', error);
            throw error;
        }
    }
    async updateProgress(userId, challengeId, progress) {
        try {
            const db = await getDb();
            const now = new Date();
            await db.collection('challenge_participants').updateOne({
                userId: new ObjectId(userId),
                challengeId: new ObjectId(challengeId),
                status: 'active'
            }, {
                $set: {
                    progress,
                    lastUpdated: now,
                    status: progress >= 100 ? 'completed' : 'active'
                }
            });
            if (progress >= 100) {
                await this.updateCompletionRate(challengeId);
            }
        }
        catch (error) {
            console.error('Error updating challenge progress:', error);
            throw error;
        }
    }
    async updateCompletionRate(challengeId) {
        try {
            const db = await getDb();
            const stats = await db.collection('challenge_participants').aggregate([
                {
                    $match: {
                        challengeId: new ObjectId(challengeId)
                    }
                },
                {
                    $group: {
                        _id: null,
                        totalParticipants: { $sum: 1 },
                        completedParticipants: {
                            $sum: {
                                $cond: [{ $eq: ['$status', 'completed'] }, 1, 0]
                            }
                        }
                    }
                }
            ]).next();
            if (stats) {
                const completionRate = (stats.completedParticipants / stats.totalParticipants) * 100;
                await db.collection('seasonal_challenges').updateOne({ _id: new ObjectId(challengeId) }, { $set: { completionRate } });
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
}
//# sourceMappingURL=seasonal-challenges.js.map
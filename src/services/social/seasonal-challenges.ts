import { ObjectId } from 'mongodb';
import { getDb } from '../../config/db';
import { Challenge, ChallengeType, ChallengeStatus } from '../../types/achievement';

export interface SeasonalChallenge extends Challenge {
  seasonType: 'spring' | 'summer' | 'autumn' | 'winter' | 'holiday';
  startDate: Date;
  endDate: Date;
  participantCount: number;
  completionRate: number;
}

export interface ChallengeParticipant {
  userId: ObjectId;
  challengeId: ObjectId;
  status: ChallengeStatus;
  progress: number;
  joinedAt: Date;
  lastUpdated: Date;
}

export class SeasonalChallengeService {
  private readonly SEASON_DURATIONS = {
    spring: { months: [2, 3, 4] },
    summer: { months: [5, 6, 7] },
    autumn: { months: [8, 9, 10] },
    winter: { months: [11, 0, 1] },
  };

  async createSeasonalChallenge(challenge: Omit<SeasonalChallenge, '_id' | 'participantCount' | 'completionRate'>): Promise<ObjectId> {
    try {
      const db = await getDb();
      
      const newChallenge = {
        ...challenge,
        participantCount: 0,
        completionRate: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const result = await db.collection<SeasonalChallenge>('seasonal_challenges').insertOne(newChallenge);
      return result.insertedId;
    } catch (error) {
      console.error('Error creating seasonal challenge:', error);
      throw error;
    }
  }

  async getActiveSeasonalChallenges(): Promise<SeasonalChallenge[]> {
    try {
      const db = await getDb();
      const now = new Date();

      const challenges = await db.collection<SeasonalChallenge>('seasonal_challenges')
        .find({
          startDate: { $lte: now },
          endDate: { $gt: now }
        })
        .sort({ endDate: 1 })
        .toArray();

      return challenges;
    } catch (error) {
      console.error('Error getting active seasonal challenges:', error);
      throw error;
    }
  }

  async joinChallenge(userId: string, challengeId: string): Promise<boolean> {
    try {
      const db = await getDb();
      const now = new Date();

      const challenge = await db.collection<SeasonalChallenge>('seasonal_challenges').findOne({
        _id: new ObjectId(challengeId),
        startDate: { $lte: now },
        endDate: { $gt: now }
      });

      if (!challenge) {
        throw new Error('Challenge not found or not active');
      }

      const participation: ChallengeParticipant = {
        userId: new ObjectId(userId),
        challengeId: new ObjectId(challengeId),
        status: 'active',
        progress: 0,
        joinedAt: now,
        lastUpdated: now
      };

      await db.collection<ChallengeParticipant>('challenge_participants').insertOne(participation);
      
      await db.collection<SeasonalChallenge>('seasonal_challenges').updateOne(
        { _id: new ObjectId(challengeId) },
        { $inc: { participantCount: 1 } }
      );

      return true;
    } catch (error) {
      console.error('Error joining challenge:', error);
      throw error;
    }
  }

  async updateProgress(userId: string, challengeId: string, progress: number): Promise<void> {
    try {
      const db = await getDb();
      const now = new Date();

      await db.collection<ChallengeParticipant>('challenge_participants').updateOne(
        {
          userId: new ObjectId(userId),
          challengeId: new ObjectId(challengeId),
          status: 'active'
        },
        {
          $set: {
            progress,
            lastUpdated: now,
            status: progress >= 100 ? 'completed' : 'active'
          }
        }
      );

      if (progress >= 100) {
        await this.updateCompletionRate(challengeId);
      }
    } catch (error) {
      console.error('Error updating challenge progress:', error);
      throw error;
    }
  }

  private async updateCompletionRate(challengeId: string): Promise<void> {
    try {
      const db = await getDb();
      
      const stats = await db.collection<ChallengeParticipant>('challenge_participants').aggregate([
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
        await db.collection<SeasonalChallenge>('seasonal_challenges').updateOne(
          { _id: new ObjectId(challengeId) },
          { $set: { completionRate } }
        );
      }
    } catch (error) {
      console.error('Error updating completion rate:', error);
      throw error;
    }
  }

  async getCurrentSeason(): Promise<'spring' | 'summer' | 'autumn' | 'winter'> {
    const now = new Date();
    const month = now.getMonth();

    for (const [season, data] of Object.entries(this.SEASON_DURATIONS)) {
      if (data.months.includes(month)) {
        return season as 'spring' | 'summer' | 'autumn' | 'winter';
      }
    }

    return 'winter'; // Default to winter if something goes wrong
  }
} 
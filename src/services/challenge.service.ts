import { ObjectId } from 'mongodb';
import { connectToDatabase } from '../db/db';
import {
  Challenge,
  UserChallengeProgress,
  CreateChallengeDto,
  UpdateChallengeDto,
  ChallengeWithProgress,
  LeaderboardEntry,
  ChallengeQueryParams
} from '../types/challenge';
import { WebSocketService } from './websocket-service';
import { CookingSession } from '../types/cooking-session';

export class ChallengeService {
  private wsService: WebSocketService;

  constructor(wsService: WebSocketService) {
    this.wsService = wsService;
  }

  /**
   * Create a new challenge
   */
  async createChallenge(data: CreateChallengeDto): Promise<ObjectId> {
    const db = await connectToDatabase();

    const challenge: Omit<Challenge, '_id'> = {
      ...data,
      status: 'upcoming',
      participantCount: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await db.collection<Challenge>('challenges').insertOne(challenge);

    // Notify all users about new challenge
    this.wsService.broadcast(JSON.stringify({
      type: 'new_challenge',
      challengeId: result.insertedId.toString()
    }));

    return result.insertedId;
  }

  /**
   * Get a challenge by ID
   */
  async getChallenge(challengeId: string, userId?: string): Promise<ChallengeWithProgress | null> {
    const db = await connectToDatabase();

    const challenge = await db.collection<Challenge>('challenges').findOne({
      _id: new ObjectId(challengeId)
    });

    if (!challenge) return null;

    const result: ChallengeWithProgress = { ...challenge };

    if (userId) {
      // Get user's progress
      const progress = await db.collection<UserChallengeProgress>('user_challenge_progress').findOne({
        challengeId: new ObjectId(challengeId),
        userId: new ObjectId(userId)
      });
      if (progress) {
        result.userProgress = progress;
      }
    }

    // Get top 10 participants
    result.topParticipants = await this.getLeaderboard(challengeId, 10);

    return result;
  }

  /**
   * Get challenges with optional filtering
   */
  async getChallenges(params: ChallengeQueryParams, userId?: string): Promise<ChallengeWithProgress[]> {
    const db = await connectToDatabase();
    const limit = params.limit || 20;
    const offset = params.offset || 0;

    const query: any = {};
    if (params.status) {
      query.status = params.status;
    }
    if (params.type) {
      query.type = params.type;
    }

    const challenges = await db.collection<Challenge>('challenges')
      .find(query)
      .sort({ startDate: -1 })
      .skip(offset)
      .limit(limit)
      .toArray();

    const result: ChallengeWithProgress[] = challenges;

    if (userId && params.includeProgress) {
      // Get user's progress for all challenges
      const progresses = await db.collection<UserChallengeProgress>('user_challenge_progress')
        .find({
          challengeId: { $in: challenges.map(c => c._id!) },
          userId: new ObjectId(userId)
        })
        .toArray();

      const progressMap = new Map(progresses.map(p => [p.challengeId.toString(), p]));
      result.forEach(challenge => {
        challenge.userProgress = progressMap.get(challenge._id!.toString());
      });
    }

    if (params.includeLeaderboard) {
      // Get top 3 participants for each challenge
      await Promise.all(result.map(async challenge => {
        challenge.topParticipants = await this.getLeaderboard(challenge._id!.toString(), 3);
      }));
    }

    return result;
  }

  /**
   * Update a challenge
   */
  async updateChallenge(challengeId: string, data: UpdateChallengeDto): Promise<void> {
    const db = await connectToDatabase();

    const update: any = {
      $set: {
        ...data,
        updatedAt: new Date()
      }
    };

    await db.collection<Challenge>('challenges').updateOne(
      { _id: new ObjectId(challengeId) },
      update
    );

    // If status changed to 'active', notify participants
    if (data.status === 'active') {
      const challenge = await this.getChallenge(challengeId);
      if (challenge) {
        this.wsService.broadcast(JSON.stringify({
          type: 'challenge_started',
          challengeId,
          name: challenge.name
        }));
      }
    }
  }

  /**
   * Join a challenge
   */
  async joinChallenge(challengeId: string, userId: string): Promise<void> {
    const db = await connectToDatabase();

    const challenge = await db.collection<Challenge>('challenges').findOne({
      _id: new ObjectId(challengeId)
    });

    if (!challenge) {
      throw new Error('Challenge not found');
    }

    if (challenge.status !== 'upcoming' && challenge.status !== 'active') {
      throw new Error('Challenge is not open for joining');
    }

    const existingProgress = await db.collection<UserChallengeProgress>('user_challenge_progress').findOne({
      challengeId: new ObjectId(challengeId),
      userId: new ObjectId(userId)
    });

    if (existingProgress) {
      throw new Error('Already joined this challenge');
    }

    const progress: Omit<UserChallengeProgress, '_id'> = {
      userId: new ObjectId(userId),
      challengeId: new ObjectId(challengeId),
      progress: 0,
      completedSessions: [],
      currentStreak: 0,
      bestStreak: 0,
      lastUpdated: new Date(),
      joinedAt: new Date()
    };

    await Promise.all([
      db.collection<UserChallengeProgress>('user_challenge_progress').insertOne(progress),
      db.collection<Challenge>('challenges').updateOne(
        { _id: new ObjectId(challengeId) },
        { $inc: { participantCount: 1 } }
      )
    ]);
  }

  /**
   * Get challenge leaderboard
   */
  async getLeaderboard(challengeId: string, limit = 100): Promise<LeaderboardEntry[]> {
    const db = await connectToDatabase();

    const entries = await db.collection<UserChallengeProgress>('user_challenge_progress').aggregate([
      { $match: { challengeId: new ObjectId(challengeId) } },
      { $sort: { progress: -1, lastUpdated: 1 } },
      { $limit: limit },
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'user'
        }
      },
      { $unwind: '$user' },
      {
        $project: {
          userId: 1,
          progress: 1,
          currentStreak: 1,
          bestStreak: 1,
          'name': '$user.name',
          'avatar': '$user.avatar'
        }
      }
    ]).toArray() as unknown as (Omit<LeaderboardEntry, 'rank'>[]);

    // Add ranks
    return entries.map((entry, index) => ({
      ...entry,
      rank: index + 1
    }));
  }

  /**
   * Update challenge progress based on a cooking session
   */
  async processCookingSession(session: CookingSession): Promise<void> {
    const db = await connectToDatabase();

    // Find active challenges that this session might qualify for
    const activeChallenges = await db.collection<Challenge>('challenges')
      .find({
        status: 'active',
        startDate: { $lte: session.startTime },
        endDate: { $gte: session.endTime }
      })
      .toArray();

    for (const challenge of activeChallenges) {
      // Check if user is participating
      const progress = await db.collection<UserChallengeProgress>('user_challenge_progress').findOne({
        challengeId: challenge._id!,
        userId: session.userId
      });

      if (!progress) continue;

      // Update progress based on challenge type
      const update: any = {
        $push: { completedSessions: session._id },
        $set: { lastUpdated: new Date() }
      };

      if (challenge.type === 'count') {
        update.$inc = { progress: 1 };
      } else if (challenge.type === 'streak') {
        // Check if the session maintains the streak
        const lastSession = progress.completedSessions.length > 0
          ? await db.collection<CookingSession>('cooking_sessions').findOne({
            _id: progress.completedSessions[progress.completedSessions.length - 1]
          })
          : null;

        const streakMaintained = !lastSession || 
          (session.startTime.getTime() - lastSession.endTime.getTime()) <= 24 * 60 * 60 * 1000;

        if (streakMaintained) {
          update.$inc = { currentStreak: 1 };
          if ((progress.currentStreak + 1) > progress.bestStreak) {
            update.$set.bestStreak = progress.currentStreak + 1;
          }
        } else {
          update.$set.currentStreak = 1;
        }
      }

      await db.collection<UserChallengeProgress>('user_challenge_progress').updateOne(
        { _id: progress._id },
        update
      );

      // Check if challenge completed
      const updatedProgress = await db.collection<UserChallengeProgress>('user_challenge_progress').findOne({
        _id: progress._id
      });

      if (updatedProgress && !updatedProgress.completedAt && 
          (updatedProgress.progress >= challenge.targetGoal || 
           updatedProgress.bestStreak >= challenge.targetGoal)) {
        // Mark as completed
        await db.collection<UserChallengeProgress>('user_challenge_progress').updateOne(
          { _id: progress._id },
          { 
            $set: { 
              completedAt: new Date()
            }
          }
        );

        // Notify user
        this.wsService.sendToUser(session.userId.toString(), JSON.stringify({
          type: 'challenge_completed',
          challengeId: challenge._id!.toString(),
          name: challenge.name,
          rewards: challenge.rewards
        }));
      }
    }
  }
} 
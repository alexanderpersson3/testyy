import { ObjectId } from 'mongodb';
import { ChallengeService } from '../challenge.service';
import { WebSocketService } from '../websocket-service';
import { Server } from 'http';
import { connectToDatabase } from '../../db/db';
import { Challenge, UserChallengeProgress } from '../../types/challenge';
import { CookingSession } from '../../types/cooking-session';

jest.mock('../websocket-service');

describe('ChallengeService', () => {
  let challengeService: ChallengeService;
  let wsService: jest.Mocked<WebSocketService>;
  let server: Server;

  const testUser1Id = '507f1f77bcf86cd799439011';
  const testUser2Id = '507f1f77bcf86cd799439012';

  beforeAll(async () => {
    server = new Server();
    wsService = new WebSocketService(server) as jest.Mocked<WebSocketService>;
    challengeService = new ChallengeService(wsService);

    // Clear test database
    const db = await connectToDatabase();
    await db.collection('challenges').deleteMany({});
    await db.collection('user_challenge_progress').deleteMany({});
  });

  afterAll(async () => {
    server.close();
    const db = await connectToDatabase();
    await db.collection('challenges').deleteMany({});
    await db.collection('user_challenge_progress').deleteMany({});
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createChallenge', () => {
    it('should create a new challenge', async () => {
      const challengeId = await challengeService.createChallenge({
        name: 'Test Challenge',
        description: 'Test Description',
        type: 'count',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
        targetGoal: 10,
        rules: ['Rule 1', 'Rule 2']
      });

      expect(challengeId).toBeDefined();
      expect(ObjectId.isValid(challengeId.toString())).toBe(true);

      const db = await connectToDatabase();
      const challenge = await db.collection<Challenge>('challenges').findOne({
        _id: challengeId
      });

      expect(challenge).toBeDefined();
      expect(challenge?.name).toBe('Test Challenge');
      expect(challenge?.status).toBe('upcoming');
      expect(challenge?.participantCount).toBe(0);

      expect(wsService.broadcast).toHaveBeenCalledWith(
        expect.stringContaining('new_challenge')
      );
    });
  });

  describe('joinChallenge', () => {
    it('should allow user to join an active challenge', async () => {
      const db = await connectToDatabase();

      // Create a challenge
      const challenge: Omit<Challenge, '_id'> = {
        name: 'Test Challenge',
        description: 'Test Description',
        type: 'count',
        startDate: new Date(),
        endDate: new Date(Date.now() + 86400000),
        targetGoal: 10,
        rules: ['Rule 1'],
        status: 'active',
        participantCount: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const result = await db.collection<Challenge>('challenges').insertOne(challenge);
      const challengeId = result.insertedId;

      // Join challenge
      await challengeService.joinChallenge(challengeId.toString(), testUser1Id);

      // Verify progress created
      const progress = await db.collection<UserChallengeProgress>('user_challenge_progress').findOne({
        challengeId,
        userId: new ObjectId(testUser1Id)
      });

      expect(progress).toBeDefined();
      expect(progress?.progress).toBe(0);
      expect(progress?.currentStreak).toBe(0);

      // Verify participant count updated
      const updatedChallenge = await db.collection<Challenge>('challenges').findOne({
        _id: challengeId
      });
      expect(updatedChallenge?.participantCount).toBe(1);
    });

    it('should not allow joining completed challenges', async () => {
      const db = await connectToDatabase();

      // Create a completed challenge
      const challenge: Omit<Challenge, '_id'> = {
        name: 'Completed Challenge',
        description: 'Test Description',
        type: 'count',
        startDate: new Date(Date.now() - 172800000),
        endDate: new Date(Date.now() - 86400000),
        targetGoal: 10,
        rules: ['Rule 1'],
        status: 'completed',
        participantCount: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const result = await db.collection<Challenge>('challenges').insertOne(challenge);

      await expect(challengeService.joinChallenge(
        result.insertedId.toString(),
        testUser1Id
      )).rejects.toThrow('Challenge is not open for joining');
    });
  });

  describe('processCookingSession', () => {
    it('should update progress for count-based challenge', async () => {
      const db = await connectToDatabase();

      // Create a challenge
      const challenge: Omit<Challenge, '_id'> = {
        name: 'Cooking Count Challenge',
        description: 'Cook 3 meals',
        type: 'count',
        startDate: new Date(Date.now() - 86400000),
        endDate: new Date(Date.now() + 86400000),
        targetGoal: 3,
        rules: ['Any meal counts'],
        status: 'active',
        participantCount: 1,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const challengeResult = await db.collection<Challenge>('challenges').insertOne(challenge);

      // Create user progress
      const progress: Omit<UserChallengeProgress, '_id'> = {
        userId: new ObjectId(testUser1Id),
        challengeId: challengeResult.insertedId,
        progress: 0,
        completedSessions: [],
        currentStreak: 0,
        bestStreak: 0,
        lastUpdated: new Date(),
        joinedAt: new Date()
      };

      await db.collection<UserChallengeProgress>('user_challenge_progress').insertOne(progress);

      // Process a cooking session
      const session: CookingSession = {
        _id: new ObjectId(),
        userId: new ObjectId(testUser1Id),
        title: 'Test Meal',
        startTime: new Date(),
        endTime: new Date(),
        photos: [],
        visibility: 'public',
        likeCount: 0,
        commentCount: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await challengeService.processCookingSession(session);

      // Verify progress updated
      const updatedProgress = await db.collection<UserChallengeProgress>('user_challenge_progress').findOne({
        challengeId: challengeResult.insertedId,
        userId: new ObjectId(testUser1Id)
      });

      expect(updatedProgress?.progress).toBe(1);
      expect(updatedProgress?.completedSessions).toHaveLength(1);
      expect(updatedProgress?.completedSessions[0]).toEqual(session._id);
    });

    it('should update streak for streak-based challenge', async () => {
      const db = await connectToDatabase();

      // Create a challenge
      const challenge: Omit<Challenge, '_id'> = {
        name: 'Cooking Streak Challenge',
        description: 'Cook daily',
        type: 'streak',
        startDate: new Date(Date.now() - 86400000),
        endDate: new Date(Date.now() + 86400000),
        targetGoal: 3,
        rules: ['Cook once per day'],
        status: 'active',
        participantCount: 1,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const challengeResult = await db.collection<Challenge>('challenges').insertOne(challenge);

      // Create user progress
      const progress: Omit<UserChallengeProgress, '_id'> = {
        userId: new ObjectId(testUser1Id),
        challengeId: challengeResult.insertedId,
        progress: 0,
        completedSessions: [],
        currentStreak: 0,
        bestStreak: 0,
        lastUpdated: new Date(),
        joinedAt: new Date()
      };

      const progressResult = await db.collection<UserChallengeProgress>('user_challenge_progress').insertOne(progress);

      // Process two cooking sessions within 24 hours
      const session1: CookingSession = {
        _id: new ObjectId(),
        userId: new ObjectId(testUser1Id),
        title: 'Meal 1',
        startTime: new Date(Date.now() - 3600000),  // 1 hour ago
        endTime: new Date(),
        photos: [],
        visibility: 'public',
        likeCount: 0,
        commentCount: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await challengeService.processCookingSession(session1);

      const session2: CookingSession = {
        _id: new ObjectId(),
        userId: new ObjectId(testUser1Id),
        title: 'Meal 2',
        startTime: new Date(),
        endTime: new Date(),
        photos: [],
        visibility: 'public',
        likeCount: 0,
        commentCount: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await challengeService.processCookingSession(session2);

      // Verify streak updated
      const updatedProgress = await db.collection<UserChallengeProgress>('user_challenge_progress').findOne({
        _id: progressResult.insertedId
      });

      expect(updatedProgress?.currentStreak).toBe(2);
      expect(updatedProgress?.bestStreak).toBe(2);
      expect(updatedProgress?.completedSessions).toHaveLength(2);
    });
  });
}); 
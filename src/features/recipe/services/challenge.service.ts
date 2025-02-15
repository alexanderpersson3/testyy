;
;
import type { Collection } from 'mongodb';
import type { WithId, Filter, UpdateFilter } from '../types/express.js';
import { db } from '../db/database.service.js';;
import { AppError } from '../utils/errors.js';;
import { Challenge, ChallengeSubmission, ChallengeStatus, ChallengeType, CreateChallengeDto, CreateSubmissionDto, ChallengeBase, ChallengeSubmissionBase,  } from '../types/challenge.js';;
import type { UserDocument } from '../types/express.js';
import { UserRole } from '../types/auth.js';;
import type { toObjectId } from '../types/express.js';
import { WithoutId } from '../types/mongodb.types.js';;
export class ChallengeService {
  private static instance: ChallengeService;
  private initialized: boolean = false;
  private challengesCollection!: Collection<WithId<Challenge>>;
  private submissionsCollection!: Collection<WithId<ChallengeSubmission>>;

  private constructor() {
    this.initialize().catch(error => {
      console.error('Failed to initialize ChallengeService:', error);
    });
  }

  private async initialize() {
    if (this.initialized) return;
    this.challengesCollection = db.getCollection<WithId<Challenge>>('challenges');
    this.submissionsCollection = db.getCollection<WithId<ChallengeSubmission>>('submissions');
    this.initialized = true;
  }

  private async ensureInitialized() {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  public static getInstance(): ChallengeService {
    if (!ChallengeService.instance) {
      ChallengeService.instance = new ChallengeService();
    }
    return ChallengeService.instance;
  }

  private async checkAdminAccess(userId: string): Promise<void> {
    const user = await db.getCollection<UserDocument>('users').findOne({
      _id: toObjectId(userId),
    });
    if (!user || user.role !== UserRole.ADMIN) {
      throw new AppError('Admin access required', 403);
    }
  }

  async createChallenge(data: CreateChallengeDto, userId: string): Promise<WithId<Challenge>> {
    await this.checkAdminAccess(userId);
    await this.ensureInitialized();

    const newChallenge: WithoutId<Challenge> = {
      ...data,
      participants: [],
      createdBy: userId,
      status: 'active' as const,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await this.challengesCollection.insertOne(newChallenge as any);
    return { ...newChallenge, _id: result.insertedId } as WithId<Challenge>;
  }

  async getChallengeById(challengeId: string): Promise<WithId<Challenge> | null> {
    await this.ensureInitialized();
    try {
      return await this.challengesCollection.findOne({
        _id: toObjectId(challengeId),
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes('ObjectId')) {
        return null;
      }
      throw error;
    }
  }

  async submitChallenge(
    challengeId: string,
    userId: string,
    submission: CreateSubmissionDto
  ): Promise<WithId<ChallengeSubmission>> {
    await this.ensureInitialized();
    const challenge = await this.getChallengeById(challengeId);

    if (!challenge) {
      throw new AppError('Challenge not found', 404);
    }

    if (challenge.status !== 'active') {
      throw new AppError('Challenge is not active', 400);
    }

    if (challenge.endDate < new Date()) {
      throw new AppError('Challenge has ended', 400);
    }

    const newSubmission: WithoutId<ChallengeSubmission> = {
      ...submission,
      challengeId,
      userId,
      status: 'pending' as const,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await this.submissionsCollection.insertOne(newSubmission as any);
    return { ...newSubmission, _id: result.insertedId } as WithId<ChallengeSubmission>;
  }

  async listChallenges(filter: Filter<Challenge> = {}): Promise<WithId<Challenge>[]> {
    await this.ensureInitialized();
    return this.challengesCollection.find(filter).sort({ createdAt: -1 }).toArray();
  }

  async updateChallenge(
    challengeId: string,
    userId: string,
    updates: UpdateFilter<Challenge>
  ): Promise<void> {
    await this.checkAdminAccess(userId);
    await this.ensureInitialized();

    const result = await this.challengesCollection.updateOne(
      { _id: toObjectId(challengeId) },
      {
        $set: {
          ...updates.$set,
          updatedAt: new Date(),
        },
      }
    );

    if (result.matchedCount === 0) {
      throw new AppError('Challenge not found', 404);
    }
  }

  async deleteChallenge(challengeId: string, userId: string): Promise<void> {
    await this.checkAdminAccess(userId);
    await this.ensureInitialized();

    const result = await this.challengesCollection.deleteOne({
      _id: toObjectId(challengeId),
    });

    if (result.deletedCount === 0) {
      throw new AppError('Challenge not found', 404);
    }
  }

  async joinChallenge(challengeId: string, userId: string): Promise<WithId<Challenge>> {
    await this.ensureInitialized();
    const challenge = await this.getChallengeById(challengeId);

    if (!challenge) {
      throw new AppError('Challenge not found', 404);
    }

    if (challenge.status !== 'active') {
      throw new AppError('Challenge is not active', 400);
    }

    if (challenge.participants.includes(userId)) {
      throw new AppError('User already joined this challenge', 400);
    }

    const result = await this.challengesCollection.findOneAndUpdate(
      { _id: toObjectId(challengeId) },
      {
        $addToSet: { participants: userId },
        $set: { updatedAt: new Date() },
      },
      { returnDocument: 'after' }
    );

    if (!result) {
      throw new AppError('Failed to join challenge', 500);
    }

    const updatedChallenge = await this.getChallengeById(challengeId);
    if (!updatedChallenge) {
      throw new AppError('Failed to retrieve updated challenge', 500);
    }

    return updatedChallenge;
  }

  async leaveChallenge(challengeId: string, userId: string): Promise<WithId<Challenge>> {
    await this.ensureInitialized();
    const challenge = await this.getChallengeById(challengeId);

    if (!challenge) {
      throw new AppError('Challenge not found', 404);
    }

    if (!challenge.participants.includes(userId)) {
      throw new AppError('User is not part of this challenge', 400);
    }

    const result = await this.challengesCollection.findOneAndUpdate(
      { _id: toObjectId(challengeId) },
      {
        $pull: { participants: userId },
        $set: { updatedAt: new Date() },
      },
      { returnDocument: 'after' }
    );

    if (!result) {
      throw new AppError('Failed to leave challenge', 500);
    }

    const updatedChallenge = await this.getChallengeById(challengeId);
    if (!updatedChallenge) {
      throw new AppError('Failed to retrieve updated challenge', 500);
    }

    return updatedChallenge;
  }
}

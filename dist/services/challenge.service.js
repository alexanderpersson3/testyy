import { db } from '../db/database.service.js';
import { AppError } from '../utils/errors.js';
import { Challenge, ChallengeSubmission, ChallengeStatus, ChallengeType, CreateChallengeDto, CreateSubmissionDto, ChallengeBase, ChallengeSubmissionBase, } from '../types/challenge.js';
import { UserRole } from '../types/auth.js';
import { WithoutId } from '../types/mongodb.types.js';
export class ChallengeService {
    constructor() {
        this.initialized = false;
        this.initialize().catch(error => {
            console.error('Failed to initialize ChallengeService:', error);
        });
    }
    async initialize() {
        if (this.initialized)
            return;
        this.challengesCollection = db.getCollection('challenges');
        this.submissionsCollection = db.getCollection('submissions');
        this.initialized = true;
    }
    async ensureInitialized() {
        if (!this.initialized) {
            await this.initialize();
        }
    }
    static getInstance() {
        if (!ChallengeService.instance) {
            ChallengeService.instance = new ChallengeService();
        }
        return ChallengeService.instance;
    }
    async checkAdminAccess(userId) {
        const user = await db.getCollection('users').findOne({
            _id: toObjectId(userId),
        });
        if (!user || user.role !== UserRole.ADMIN) {
            throw new AppError('Admin access required', 403);
        }
    }
    async createChallenge(data, userId) {
        await this.checkAdminAccess(userId);
        await this.ensureInitialized();
        const newChallenge = {
            ...data,
            participants: [],
            createdBy: userId,
            status: 'active',
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        const result = await this.challengesCollection.insertOne(newChallenge);
        return { ...newChallenge, _id: result.insertedId };
    }
    async getChallengeById(challengeId) {
        await this.ensureInitialized();
        try {
            return await this.challengesCollection.findOne({
                _id: toObjectId(challengeId),
            });
        }
        catch (error) {
            if (error instanceof Error && error.message.includes('ObjectId')) {
                return null;
            }
            throw error;
        }
    }
    async submitChallenge(challengeId, userId, submission) {
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
        const newSubmission = {
            ...submission,
            challengeId,
            userId,
            status: 'pending',
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        const result = await this.submissionsCollection.insertOne(newSubmission);
        return { ...newSubmission, _id: result.insertedId };
    }
    async listChallenges(filter = {}) {
        await this.ensureInitialized();
        return this.challengesCollection.find(filter).sort({ createdAt: -1 }).toArray();
    }
    async updateChallenge(challengeId, userId, updates) {
        await this.checkAdminAccess(userId);
        await this.ensureInitialized();
        const result = await this.challengesCollection.updateOne({ _id: toObjectId(challengeId) }, {
            $set: {
                ...updates.$set,
                updatedAt: new Date(),
            },
        });
        if (result.matchedCount === 0) {
            throw new AppError('Challenge not found', 404);
        }
    }
    async deleteChallenge(challengeId, userId) {
        await this.checkAdminAccess(userId);
        await this.ensureInitialized();
        const result = await this.challengesCollection.deleteOne({
            _id: toObjectId(challengeId),
        });
        if (result.deletedCount === 0) {
            throw new AppError('Challenge not found', 404);
        }
    }
    async joinChallenge(challengeId, userId) {
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
        const result = await this.challengesCollection.findOneAndUpdate({ _id: toObjectId(challengeId) }, {
            $addToSet: { participants: userId },
            $set: { updatedAt: new Date() },
        }, { returnDocument: 'after' });
        if (!result) {
            throw new AppError('Failed to join challenge', 500);
        }
        const updatedChallenge = await this.getChallengeById(challengeId);
        if (!updatedChallenge) {
            throw new AppError('Failed to retrieve updated challenge', 500);
        }
        return updatedChallenge;
    }
    async leaveChallenge(challengeId, userId) {
        await this.ensureInitialized();
        const challenge = await this.getChallengeById(challengeId);
        if (!challenge) {
            throw new AppError('Challenge not found', 404);
        }
        if (!challenge.participants.includes(userId)) {
            throw new AppError('User is not part of this challenge', 400);
        }
        const result = await this.challengesCollection.findOneAndUpdate({ _id: toObjectId(challengeId) }, {
            $pull: { participants: userId },
            $set: { updatedAt: new Date() },
        }, { returnDocument: 'after' });
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
//# sourceMappingURL=challenge.service.js.map
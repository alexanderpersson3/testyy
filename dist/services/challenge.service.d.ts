import type { WithId, Filter, UpdateFilter } from '../types/index.js';
import { Challenge, ChallengeSubmission, CreateChallengeDto, CreateSubmissionDto } from '../types/challenge.js';
export declare class ChallengeService {
    private static instance;
    private initialized;
    private challengesCollection;
    private submissionsCollection;
    private constructor();
    private initialize;
    private ensureInitialized;
    static getInstance(): ChallengeService;
    private checkAdminAccess;
    createChallenge(data: CreateChallengeDto, userId: string): Promise<WithId<Challenge>>;
    getChallengeById(challengeId: string): Promise<WithId<Challenge> | null>;
    submitChallenge(challengeId: string, userId: string, submission: CreateSubmissionDto): Promise<WithId<ChallengeSubmission>>;
    listChallenges(filter?: Filter<Challenge>): Promise<WithId<Challenge>[]>;
    updateChallenge(challengeId: string, userId: string, updates: UpdateFilter<Challenge>): Promise<void>;
    deleteChallenge(challengeId: string, userId: string): Promise<void>;
    joinChallenge(challengeId: string, userId: string): Promise<WithId<Challenge>>;
    leaveChallenge(challengeId: string, userId: string): Promise<WithId<Challenge>>;
}

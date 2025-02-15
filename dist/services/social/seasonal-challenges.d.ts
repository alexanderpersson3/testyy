import type { UserChallengeDocument } from '../types/index.js';
import { SeasonalChallenge, SeasonalChallengeBase, ChallengeParticipant } from '../../types/social.js';
export declare class SeasonalChallengeService {
    private readonly SEASON_DURATIONS;
    private db;
    constructor();
    createChallenge(newChallenge: SeasonalChallengeBase): Promise<SeasonalChallenge>;
    getAllChallenges(): Promise<SeasonalChallenge[]>;
    getChallenge(challengeId: string): Promise<SeasonalChallenge | null>;
    participateInChallenge(challengeId: string, userId: string, participation: Omit<ChallengeParticipant, '_id'>): Promise<void>;
    updateParticipation(challengeId: string, userId: string, updates: Partial<ChallengeParticipant>): Promise<void>;
    getLeaderboard(challengeId: string): Promise<any[]>;
    completeChallenge(userId: string, challengeId: string): Promise<void>;
    getActiveSeasonalChallenges(): Promise<SeasonalChallenge[]>;
    joinChallenge(userId: string, challengeId: string): Promise<boolean>;
    updateProgress(userId: string, challengeId: string, progress: number): Promise<void>;
    private updateCompletionRate;
    getCurrentSeason(): Promise<'spring' | 'summer' | 'autumn' | 'winter'>;
    getCurrentChallenges(): Promise<SeasonalChallenge[]>;
    getChallengeProgress(userId: string, challengeId: string): Promise<UserChallengeDocument | null>;
}

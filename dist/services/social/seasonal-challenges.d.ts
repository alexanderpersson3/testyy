import { ObjectId } from 'mongodb';
import { Challenge, ChallengeStatus } from '../../types/achievement';
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
export declare class SeasonalChallengeService {
    private readonly SEASON_DURATIONS;
    createSeasonalChallenge(challenge: Omit<SeasonalChallenge, '_id' | 'participantCount' | 'completionRate'>): Promise<ObjectId>;
    getActiveSeasonalChallenges(): Promise<SeasonalChallenge[]>;
    joinChallenge(userId: string, challengeId: string): Promise<boolean>;
    updateProgress(userId: string, challengeId: string, progress: number): Promise<void>;
    private updateCompletionRate;
    getCurrentSeason(): Promise<'spring' | 'summer' | 'autumn' | 'winter'>;
}
//# sourceMappingURL=seasonal-challenges.d.ts.map
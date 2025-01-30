import { ObjectId } from 'mongodb';
import { CreateChallengeDto, UpdateChallengeDto, ChallengeWithProgress, LeaderboardEntry, ChallengeQueryParams } from '../types/challenge';
import { WebSocketService } from './websocket-service';
import { CookingSession } from '../types/cooking-session';
export declare class ChallengeService {
    private wsService;
    constructor(wsService: WebSocketService);
    /**
     * Create a new challenge
     */
    createChallenge(data: CreateChallengeDto): Promise<ObjectId>;
    /**
     * Get a challenge by ID
     */
    getChallenge(challengeId: string, userId?: string): Promise<ChallengeWithProgress | null>;
    /**
     * Get challenges with optional filtering
     */
    getChallenges(params: ChallengeQueryParams, userId?: string): Promise<ChallengeWithProgress[]>;
    /**
     * Update a challenge
     */
    updateChallenge(challengeId: string, data: UpdateChallengeDto): Promise<void>;
    /**
     * Join a challenge
     */
    joinChallenge(challengeId: string, userId: string): Promise<void>;
    /**
     * Get challenge leaderboard
     */
    getLeaderboard(challengeId: string, limit?: number): Promise<LeaderboardEntry[]>;
    /**
     * Update challenge progress based on a cooking session
     */
    processCookingSession(session: CookingSession): Promise<void>;
}
//# sourceMappingURL=challenge.service.d.ts.map
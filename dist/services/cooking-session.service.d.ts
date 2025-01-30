import { ObjectId } from 'mongodb';
import { CookingSessionComment, CookingSessionWithUser, CreateCookingSessionDto, UpdateCookingSessionDto, CookingSessionFeedParams } from '../types/cooking-session';
import { WebSocketService } from './websocket-service';
import { ChallengeService } from './challenge.service';
export declare class CookingSessionService {
    private wsService;
    private challengeService;
    constructor(wsService: WebSocketService, challengeService: ChallengeService);
    /**
     * Create a new cooking session
     */
    createSession(userId: string, data: CreateCookingSessionDto): Promise<ObjectId>;
    /**
     * Get a cooking session by ID
     */
    getSession(sessionId: string, currentUserId?: string): Promise<CookingSessionWithUser | null>;
    /**
     * Get cooking session feed
     */
    getFeed(params: CookingSessionFeedParams, currentUserId?: string): Promise<CookingSessionWithUser[]>;
    /**
     * Update a cooking session
     */
    updateSession(sessionId: string, userId: string, data: UpdateCookingSessionDto): Promise<void>;
    /**
     * Delete a cooking session
     */
    deleteSession(sessionId: string, userId: string): Promise<void>;
    /**
     * Like a cooking session
     */
    likeSession(sessionId: string, userId: string): Promise<void>;
    /**
     * Unlike a cooking session
     */
    unlikeSession(sessionId: string, userId: string): Promise<void>;
    /**
     * Add a comment to a cooking session
     */
    addComment(sessionId: string, userId: string, text: string): Promise<ObjectId>;
    /**
     * Get comments for a cooking session
     */
    getComments(sessionId: string, limit?: number, offset?: number): Promise<CookingSessionComment[]>;
}
//# sourceMappingURL=cooking-session.service.d.ts.map
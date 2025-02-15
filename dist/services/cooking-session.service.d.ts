import { ObjectId } from 'mongodb';
import { CookingSession, CookingSessionComment, CookingSessionPhoto, CookingSessionInvite, CookingSessionFeedParams, CreateCookingSessionDTO, UpdateStepProgressDTO, UpdateTimerDTO, UpdateCookingSessionDTO } from '../types/cooking-session.js';
import type { Recipe } from '../types/index.js';
interface CreateSessionOptions {
    scheduledFor?: Date;
    maxParticipants?: number;
    isPrivate?: boolean;
}
export interface CookingSessionWithUser extends CookingSession {
    recipe: Recipe;
    host: {
        _id: ObjectId;
        name: string;
        avatar?: string;
    };
    isLiked?: boolean;
    likesCount: number;
}
export interface CookingSessionStats {
    totalSessions: number;
    completedSessions: number;
    averageRating: number;
    totalCookingTime: number;
    favoriteCuisines: string[];
}
export declare class CookingSessionService {
    private static instance;
    private wsService;
    private notificationService;
    private db;
    private readonly COLLECTION;
    private readonly LIKES_COLLECTION;
    private readonly INVITES_COLLECTION;
    private readonly USERS_COLLECTION;
    private readonly RECIPES_COLLECTION;
    private constructor();
    static getInstance(): CookingSessionService;
    private getSessionsCollection;
    private getLikesCollection;
    private getInvitesCollection;
    private getUsersCollection;
    private getRecipesCollection;
    private getFollowsCollection;
    private broadcastToSession;
    /**
     * Create a new cooking session
     */
    createSession(recipeId: ObjectId, hostId: ObjectId, options?: CreateSessionOptions): Promise<CookingSession>;
    /**
     * Join a cooking session
     */
    joinSession(sessionId: ObjectId, userId: ObjectId): Promise<boolean>;
    /**
     * Start a cooking session
     */
    startSession(sessionId: ObjectId, hostId: ObjectId): Promise<boolean>;
    /**
     * End a cooking session
     */
    endSession(sessionId: ObjectId, hostId: ObjectId): Promise<boolean>;
    /**
     * Update participant's current step
     */
    updateStep(sessionId: ObjectId, userId: ObjectId, stepNumber: number, completed: boolean): Promise<boolean>;
    /**
     * Add a photo to the session
     */
    addPhoto(sessionId: ObjectId, userId: ObjectId, imageUrl: string, options?: {
        caption?: string;
        stepNumber?: number;
    }): Promise<CookingSessionPhoto>;
    /**
     * Add a comment to the session
     */
    addComment(sessionId: ObjectId, userId: ObjectId, content: string, stepNumber?: number): Promise<CookingSessionComment>;
    /**
     * Create an invite for a session
     */
    createInvite(sessionId: ObjectId, invitedBy: ObjectId, email: string): Promise<CookingSessionInvite>;
    /**
     * Accept an invite to join a session
     */
    acceptInvite(inviteId: ObjectId, userId: ObjectId): Promise<boolean>;
    /**
     * Get a session by ID
     */
    getSession(sessionId: ObjectId): Promise<CookingSession | null>;
    /**
     * List active sessions
     */
    listActiveSessions(options?: {
        limit?: number;
        offset?: number;
        includePrivate?: boolean;
    }): Promise<CookingSession[]>;
    /**
     * Get session by ID with user details
     */
    getSessionById(sessionId: string, currentUserId?: string): Promise<CookingSessionWithUser | null>;
    /**
     * Get session feed
     */
    getFeed(params: CookingSessionFeedParams, currentUserId?: string): Promise<CookingSessionWithUser[]>;
    /**
     * Update session details
     */
    updateSession(sessionId: string, userId: string, data: UpdateCookingSessionDTO): Promise<void>;
    /**
     * Delete a session
     */
    deleteSession(sessionId: string, userId: string): Promise<void>;
    /**
     * Like a session
     */
    likeSession(sessionId: string, userId: string): Promise<void>;
    /**
     * Unlike a session
     */
    unlikeSession(sessionId: string, userId: string): Promise<void>;
    /**
     * Get session comments
     */
    getComments(sessionId: string, limit?: number, offset?: number): Promise<CookingSessionComment[]>;
    /**
     * Start a new cooking session
     */
    initiateSession(userId: string, data: CreateCookingSessionDTO): Promise<ObjectId>;
    /**
     * Update step progress
     */
    updateStepProgress(sessionId: string, userId: string, stepIndex: number, data: UpdateStepProgressDTO): Promise<void>;
    /**
     * Update timer status
     */
    updateTimer(sessionId: string, userId: string, stepIndex: number, timerId: string, data: UpdateTimerDTO): Promise<void>;
    /**
     * Complete a cooking session
     */
    private completeSession;
    /**
     * Get user statistics
     */
    getUserStats(userId: string): Promise<CookingSessionStats>;
}
export {};

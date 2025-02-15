import { ObjectId } from 'mongodb';
import { CollaborationSession, CollaborationChange, ResourceType } from '../types/collaboration.js';
export declare class CollaborationService {
    private static instance;
    private wsService;
    private constructor();
    static getInstance(): CollaborationService;
    /**
     * Join collaboration session
     */
    joinSession(userId: ObjectId, sessionId: string, resourceId: ObjectId, resourceType: ResourceType): Promise<CollaborationSession>;
    /**
     * Leave collaboration session
     */
    leaveSession(userId: ObjectId, resourceId: ObjectId, resourceType: ResourceType): Promise<void>;
    /**
     * Apply change to resource
     */
    applyChange(change: Omit<CollaborationChange, 'timestamp'>): Promise<void>;
    /**
     * Get active participants in a session
     */
    getActiveParticipants(resourceId: ObjectId, resourceType: ResourceType): Promise<CollaborationSession['participants']>;
    /**
     * Get recent changes in a session
     */
    getRecentChanges(resourceId: ObjectId, resourceType: ResourceType, limit?: number): Promise<CollaborationChange[]>;
    /**
     * Clean up inactive sessions
     */
    cleanupInactiveSessions(maxInactiveTime?: number): Promise<void>;
    /**
     * Get room ID for WebSocket communication
     */
    private getRoomId;
}

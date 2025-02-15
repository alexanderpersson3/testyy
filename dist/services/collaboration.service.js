import { ObjectId } from 'mongodb';
;
import { WebSocketService } from '../websocket.service.js';
import { connectToDatabase } from '../db.js';
import logger from '../utils/logger.js';
import { CollaborationSession, CollaborationChange, CollaborationOperation, ResourceType, } from '../types/collaboration.js';
export class CollaborationService {
    constructor() {
        this.wsService = WebSocketService.getInstance();
    }
    static getInstance() {
        if (!CollaborationService.instance) {
            CollaborationService.instance = new CollaborationService();
        }
        return CollaborationService.instance;
    }
    /**
     * Join collaboration session
     */
    async joinSession(userId, sessionId, resourceId, resourceType) {
        const db = await connectToDatabase();
        const now = new Date();
        // Get or create session
        let session = await db.collection('collaboration_sessions').findOne({
            resourceId,
            resourceType,
        });
        if (!session) {
            const newSession = {
                resourceId,
                resourceType,
                participants: [],
                changes: [],
                createdAt: now,
                updatedAt: now,
            };
            const result = await db
                .collection('collaboration_sessions')
                .insertOne(newSession);
            session = {
                ...newSession,
                _id: result.insertedId,
            };
        }
        // Add participant if not already in session
        const participantExists = session.participants.some(p => p.userId.equals(userId));
        if (!participantExists) {
            await db.collection('collaboration_sessions').updateOne({ _id: session._id }, {
                $push: {
                    participants: {
                        userId,
                        sessionId,
                        joinedAt: now,
                        lastActiveAt: now,
                    },
                },
            });
            session.participants.push({
                userId,
                sessionId,
                joinedAt: now,
                lastActiveAt: now,
            });
        }
        else {
            // Update last active timestamp
            await db.collection('collaboration_sessions').updateOne({
                _id: session._id,
                'participants.userId': userId,
            }, {
                $set: {
                    'participants.$.lastActiveAt': now,
                    'participants.$.sessionId': sessionId,
                },
            });
            const participant = session.participants.find(p => p.userId.equals(userId));
            if (participant) {
                participant.lastActiveAt = now;
                participant.sessionId = sessionId;
            }
        }
        // Join WebSocket room
        await this.wsService.emitToUser(userId, 'collaboration:update', {
            type: 'join',
            resourceId,
            resourceType,
            userId
        });
        // Notify other participants
        this.wsService.broadcast('collaboration:room:' + this.getRoomId(resourceId, resourceType), {
            type: 'update',
            resourceId,
            resourceType,
            userId,
            data: {
                type: 'participant_joined',
                payload: {
                    userId,
                    sessionId,
                    timestamp: now,
                },
            }
        });
        return session;
    }
    /**
     * Leave collaboration session
     */
    async leaveSession(userId, resourceId, resourceType) {
        const db = await connectToDatabase();
        const now = new Date();
        // Remove participant from session
        await db.collection('collaboration_sessions').updateOne({
            resourceId,
            resourceType,
        }, {
            $pull: {
                participants: {
                    userId,
                },
            },
        });
        // Leave WebSocket room
        await this.wsService.emitToUser(userId, 'collaboration:update', {
            type: 'leave',
            resourceId,
            resourceType,
            userId
        });
        // Notify other participants
        this.wsService.broadcast('collaboration:room:' + this.getRoomId(resourceId, resourceType), {
            type: 'update',
            resourceId,
            resourceType,
            userId,
            data: {
                type: 'participant_left',
                payload: {
                    userId,
                    timestamp: now,
                },
            }
        });
    }
    /**
     * Apply change to resource
     */
    async applyChange(change) {
        const db = await connectToDatabase();
        const now = new Date();
        const fullChange = {
            ...change,
            timestamp: now,
        };
        // Record change
        await db.collection('collaboration_sessions').updateOne({
            resourceId: change.resourceId,
            resourceType: change.resourceType,
        }, {
            $push: {
                changes: {
                    userId: change.userId,
                    timestamp: now,
                    operation: change.operation,
                },
            },
            $set: {
                updatedAt: now,
            },
        });
        // Update participant's last active timestamp
        await db.collection('collaboration_sessions').updateOne({
            resourceId: change.resourceId,
            resourceType: change.resourceType,
            'participants.userId': change.userId,
        }, {
            $set: {
                'participants.$.lastActiveAt': now,
            },
        });
        // Broadcast change to room
        this.wsService.broadcast('collaboration:room:' + this.getRoomId(change.resourceId, change.resourceType), {
            type: 'update',
            resourceId: change.resourceId,
            resourceType: change.resourceType,
            userId: change.userId,
            data: fullChange
        });
    }
    /**
     * Get active participants in a session
     */
    async getActiveParticipants(resourceId, resourceType) {
        const db = await connectToDatabase();
        const session = await db.collection('collaboration_sessions').findOne({
            resourceId,
            resourceType,
        });
        return session?.participants || [];
    }
    /**
     * Get recent changes in a session
     */
    async getRecentChanges(resourceId, resourceType, limit = 50) {
        const db = await connectToDatabase();
        const session = await db.collection('collaboration_sessions').findOne({
            resourceId,
            resourceType,
        });
        if (!session) {
            return [];
        }
        return session.changes
            .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
            .slice(0, limit)
            .map(change => ({
            userId: change.userId,
            resourceId,
            resourceType,
            operation: change.operation,
            timestamp: change.timestamp,
        }));
    }
    /**
     * Clean up inactive sessions
     */
    async cleanupInactiveSessions(maxInactiveTime = 24 * 60 * 60 * 1000) {
        const db = await connectToDatabase();
        const cutoff = new Date(Date.now() - maxInactiveTime);
        await db.collection('collaboration_sessions').deleteMany({
            'participants.lastActiveAt': { $lt: cutoff },
        });
    }
    /**
     * Get room ID for WebSocket communication
     */
    getRoomId(resourceId, resourceType) {
        return `${resourceType}:${resourceId.toString()}`;
    }
}
//# sourceMappingURL=collaboration.service.js.map
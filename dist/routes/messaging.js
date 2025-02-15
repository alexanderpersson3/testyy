import express, { Request, Response, NextFunction, RequestHandler } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/require-auth.js';
import { MessagingService } from '../services/messaging-service.js';
import { WebSocketService } from '../services/websocket-service.js';
import { Server } from 'http';
import { ObjectId } from 'mongodb';
;
const router = express.Router();
// Initialize WebSocket and Messaging services
const initializeServices = (server) => {
    const wsService = WebSocketService.getInstance();
    const messagingService = MessagingService.getInstance();
    // Create conversation schema
    const createConversationSchema = z.object({
        body: z.object({
            participantIds: z.array(z.string()),
            isGroup: z.boolean().optional(),
            groupName: z.string().optional(),
            groupAvatar: z.string().optional(),
        }),
    });
    // Send message schema
    const sendMessageSchema = z.object({
        body: z.object({
            text: z.string().min(1),
        }),
    });
    // Add members schema
    const addMembersSchema = z.object({
        body: z.object({
            memberIds: z.array(z.string()),
        }),
    });
    // Helper function to wrap async route handlers
    const asyncHandler = (fn) => {
        return (req, res, next) => {
            Promise.resolve(fn(req, res, next)).catch(next);
        };
    };
    // Create conversation
    router.post('/', requireAuth, validateRequest(createConversationSchema), asyncHandler(async (req, res) => {
        const user = req.user;
        if (!user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const { participantIds, isGroup, groupName, groupAvatar } = req.body;
        const conversationId = await messagingService.createConversation(new ObjectId(user.id), participantIds.map((id) => new ObjectId(id)));
        res.status(201).json({ conversationId });
    }));
    // Get user's conversations
    router.get('/', requireAuth, asyncHandler(async (req, res) => {
        const user = req.user;
        if (!user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        // TODO: Implement getConversations method in MessagingService
        res.status(501).json({ error: 'Not implemented' });
    }));
    // Send message
    router.post('/:conversationId/messages', requireAuth, validateRequest(sendMessageSchema), asyncHandler(async (req, res) => {
        const user = req.user;
        if (!user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const { text } = req.body;
        const messageId = await messagingService.sendMessage(new ObjectId(req.params.conversationId), new ObjectId(user.id), text);
        res.status(201).json({ messageId });
    }));
    // Get messages
    router.get('/:conversationId/messages', requireAuth, asyncHandler(async (req, res) => {
        if (!req.user?.id) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const { before, limit } = req.query;
        const result = await messagingService.getConversation(new ObjectId(req.params.conversationId), new ObjectId(req.user.id));
        res.json({
            conversation: {
                ...result.conversation,
                _id: result.conversation._id?.toString(),
                participants: result.conversation.participants.map(p => p.toString())
            },
            messages: result.messages.map(msg => ({
                ...msg,
                _id: msg._id?.toString(),
                senderId: msg.senderId.toString(),
                conversationId: msg.conversationId.toString()
            }))
        });
    }));
    // Mark messages as read
    router.post('/:conversationId/messages/read', requireAuth, asyncHandler(async (req, res) => {
        const user = req.user;
        if (!user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const { messageIds } = req.body;
        await messagingService.markAsRead(messageIds.map((id) => new ObjectId(id)), new ObjectId(user.id));
        res.status(204).send();
    }));
    // TODO: Implement group management features
    // - Add members to group
    // - Leave conversation
    return router;
};
export default initializeServices;
//# sourceMappingURL=messaging.js.map
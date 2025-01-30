import express from 'express';
import { z } from 'zod';
import { validateRequest } from '../middleware/validate-request';
import { requireAuth } from '../middleware/require-auth';
import MessagingService from '../services/messaging-service';
import { WebSocketService } from '../services/websocket-service';
const router = express.Router();
// Initialize WebSocket and Messaging services
const initializeServices = (server) => {
    const wsService = new WebSocketService(server);
    const messagingService = new MessagingService(wsService);
    // Create conversation schema
    const createConversationSchema = z.object({
        body: z.object({
            participantIds: z.array(z.string()),
            isGroup: z.boolean().optional(),
            groupName: z.string().optional(),
            groupAvatar: z.string().optional()
        })
    });
    // Send message schema
    const sendMessageSchema = z.object({
        body: z.object({
            text: z.string().min(1)
        })
    });
    // Add members schema
    const addMembersSchema = z.object({
        body: z.object({
            memberIds: z.array(z.string())
        })
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
        const conversationId = await messagingService.createConversation(user.id, participantIds, { isGroup, groupName, groupAvatar });
        res.status(201).json({ conversationId });
    }));
    // Get user's conversations
    router.get('/', requireAuth, asyncHandler(async (req, res) => {
        const user = req.user;
        if (!user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const conversations = await messagingService.getConversations(user.id);
        res.json(conversations);
    }));
    // Send message
    router.post('/:conversationId/messages', requireAuth, validateRequest(sendMessageSchema), asyncHandler(async (req, res) => {
        const user = req.user;
        if (!user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const { text } = req.body;
        const messageId = await messagingService.sendMessage(user.id, req.params.conversationId, text);
        res.status(201).json({ messageId });
    }));
    // Get messages
    router.get('/:conversationId/messages', requireAuth, asyncHandler(async (req, res) => {
        if (!req.user?.id) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const { before, limit } = req.query;
        const messages = await messagingService.getMessages(req.params.conversationId, req.user.id, {
            before: before ? new Date(before) : undefined,
            limit: limit ? parseInt(limit) : undefined
        });
        res.json(messages);
    }));
    // Mark messages as read
    router.post('/:conversationId/messages/read', requireAuth, asyncHandler(async (req, res) => {
        const user = req.user;
        if (!user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const { messageIds } = req.body;
        await messagingService.markAsRead(user.id, messageIds);
        res.status(204).send();
    }));
    // Add members to group
    router.post('/:conversationId/members', requireAuth, validateRequest(addMembersSchema), asyncHandler(async (req, res) => {
        const user = req.user;
        if (!user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const { memberIds } = req.body;
        await messagingService.addGroupMembers(req.params.conversationId, user.id, memberIds);
        res.status(204).send();
    }));
    // Leave conversation
    router.delete('/:conversationId/leave', requireAuth, asyncHandler(async (req, res) => {
        const user = req.user;
        if (!user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        await messagingService.leaveConversation(user.id, req.params.conversationId);
        res.status(204).send();
    }));
    return router;
};
export default initializeServices;
//# sourceMappingURL=messaging.js.map
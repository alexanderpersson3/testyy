import express, { Response } from 'express';
import { z } from 'zod';
import { auth } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ChatService } from '../services/chat.service.js';
import { ValidationError, NotFoundError } from '../utils/errors.js';
import { ObjectId } from 'mongodb';
;
const router = express.Router();
const chatService = ChatService.getInstance();
// Validation schemas
const messageSchema = z.object({
    content: z.string().min(1).max(1000),
});
const paginationSchema = z.object({
    limit: z.number().min(1).max(100).optional(),
    before: z.string().optional(),
});
// Get messages for a recipe
router.get('/recipes/:recipeId/messages', auth, validateRequest(paginationSchema), asyncHandler(async (req, res) => {
    const { limit, before } = req.query;
    const messages = await chatService.getRoomMessages(new ObjectId(req.params.recipeId), limit ? parseInt(limit) : undefined, before ? new Date(before) : undefined);
    res.json({ success: true, messages });
}));
// Send a message
router.post('/recipes/:recipeId/messages', auth, validateRequest(messageSchema), asyncHandler(async (req, res) => {
    if (!req.user) {
        throw new ValidationError('Authentication required');
    }
    const message = await chatService.sendMessage(new ObjectId(req.params.recipeId), new ObjectId(req.user.id), req.body.content);
    res.json({ success: true, message });
}));
// Add user to room
router.post('/recipes/:recipeId/participants', auth, asyncHandler(async (req, res) => {
    if (!req.user) {
        throw new ValidationError('Authentication required');
    }
    await chatService.addUserToRoom(new ObjectId(req.params.recipeId), new ObjectId(req.user.id));
    res.json({ success: true });
}));
// Remove user from room
router.delete('/recipes/:recipeId/participants', auth, asyncHandler(async (req, res) => {
    if (!req.user) {
        throw new ValidationError('Authentication required');
    }
    await chatService.removeUserFromRoom(new ObjectId(req.params.recipeId), new ObjectId(req.user.id));
    res.json({ success: true });
}));
// Get room info
router.get('/recipes/:recipeId', auth, asyncHandler(async (req, res) => {
    const room = await chatService.getRoom(new ObjectId(req.params.recipeId));
    if (!room) {
        throw new NotFoundError('Chat room not found');
    }
    res.json({ success: true, room });
}));
export default router;
//# sourceMappingURL=chat.js.map
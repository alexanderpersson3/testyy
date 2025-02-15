import { connectToDatabase } from '../db.js';
import { WebSocketService } from '../websocket-service.js';
import logger from '../utils/logger.js';
export class MessagingService {
    constructor() {
        this.wsService = WebSocketService.getInstance();
    }
    static getInstance() {
        if (!MessagingService.instance) {
            MessagingService.instance = new MessagingService();
        }
        return MessagingService.instance;
    }
    async createConversation(creatorId, participantIds) {
        const db = await connectToDatabase();
        const now = new Date();
        const conversation = {
            participants: [creatorId, ...participantIds],
            createdAt: now,
            updatedAt: now,
        };
        const result = await db.collection('conversations').insertOne(conversation);
        const newConversation = { ...conversation, _id: result.insertedId };
        // Notify other participants
        participantIds.forEach(userId => {
            this.wsService.emitToUser(userId, 'new_conversation', {
                conversationId: result.insertedId,
                createdBy: creatorId,
            });
        });
        return newConversation;
    }
    async sendMessage(conversationId, senderId, content) {
        const db = await connectToDatabase();
        // Verify sender is part of conversation
        const conversation = await db.collection('conversations').findOne({
            _id: conversationId,
            participants: senderId,
        });
        if (!conversation) {
            throw new Error('Conversation not found or user not authorized');
        }
        const now = new Date();
        const message = {
            conversationId,
            senderId,
            content,
            createdAt: now,
        };
        const result = await db.collection('messages').insertOne(message);
        const newMessage = { ...message, _id: result.insertedId };
        // Update conversation last message timestamp
        await db.collection('conversations').updateOne({ _id: conversationId }, { $set: { lastMessageAt: now, updatedAt: now } });
        // Notify other participants
        conversation.participants.forEach(userId => {
            if (!userId.equals(senderId)) {
                this.wsService.emitToUser(userId, 'new_message', newMessage);
            }
        });
        return newMessage;
    }
    async getConversation(conversationId, userId) {
        const db = await connectToDatabase();
        const conversation = await db.collection('conversations').findOne({
            _id: conversationId,
            participants: userId,
        });
        if (!conversation) {
            throw new Error('Conversation not found or user not authorized');
        }
        const messages = await db
            .collection('messages')
            .find({ conversationId })
            .sort({ createdAt: -1 })
            .limit(50)
            .toArray();
        return { conversation, messages };
    }
    async markAsRead(messageIds, userId) {
        const db = await connectToDatabase();
        const now = new Date();
        const result = await db.collection('messages').updateMany({
            _id: { $in: messageIds },
            conversationId: { $in: await this.getUserConversationIds(userId) },
            readAt: { $exists: false },
        }, {
            $set: { readAt: now },
        });
        if (result.modifiedCount > 0) {
            const messages = await db
                .collection('messages')
                .find({ _id: { $in: messageIds } })
                .toArray();
            messages.forEach(message => {
                this.wsService.emitToUser(message.senderId, 'message_read', {
                    messageId: message._id,
                    readBy: userId,
                    readAt: now,
                });
            });
        }
    }
    async getUserConversationIds(userId) {
        const db = await connectToDatabase();
        const conversations = await db
            .collection('conversations')
            .find({ participants: userId })
            .project({ _id: 1 })
            .toArray();
        return conversations.map(c => c._id);
    }
}
MessagingService.instance = null;
//# sourceMappingURL=messaging-service.js.map
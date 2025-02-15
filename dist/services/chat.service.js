import { connectToDatabase } from '../db.js';
import { WebSocketService } from '../websocket.service.js';
import { ChatMessage, ChatRoom } from '../types/chat.js';
export class ChatService {
    constructor() {
        this.wsService = WebSocketService.getInstance();
    }
    static getInstance() {
        if (!ChatService.instance) {
            ChatService.instance = new ChatService();
        }
        return ChatService.instance;
    }
    async createRoom(name, creatorId) {
        const db = await connectToDatabase();
        const room = {
            name,
            creatorId,
            participants: [creatorId],
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        const result = await db.collection('chat_rooms').insertOne(room);
        return {
            ...room,
            _id: result.insertedId,
        };
    }
    async getRoom(roomId) {
        const db = await connectToDatabase();
        return db.collection('chat_rooms').findOne({ _id: roomId });
    }
    async getRoomMessages(roomId, limit = 50, before) {
        const db = await connectToDatabase();
        const query = { roomId };
        if (before) {
            query.createdAt = { $lt: before };
        }
        return db
            .collection('chat_messages')
            .find(query)
            .sort({ createdAt: -1 })
            .limit(limit)
            .toArray();
    }
    async sendMessage(roomId, userId, content) {
        const db = await connectToDatabase();
        // Check if user is in room
        const room = await this.getRoom(roomId);
        if (!room || !room.participants.some((p) => p.equals(userId))) {
            throw new Error('User is not in room');
        }
        const message = {
            roomId,
            userId,
            content,
            createdAt: new Date(),
        };
        const result = await db
            .collection('chat_messages')
            .insertOne(message);
        const newMessage = {
            ...message,
            _id: result.insertedId,
        };
        // Notify room participants
        room.participants.forEach((participantId) => {
            if (!participantId.equals(userId)) {
                this.wsService.emitToUser(participantId, 'new_message', newMessage);
            }
        });
        return newMessage;
    }
    async addUserToRoom(roomId, userId) {
        const db = await connectToDatabase();
        await db.collection('chat_rooms').updateOne({ _id: roomId }, {
            $addToSet: { participants: userId },
            $set: { updatedAt: new Date() },
        });
    }
    async removeUserFromRoom(roomId, userId) {
        const db = await connectToDatabase();
        await db.collection('chat_rooms').updateOne({ _id: roomId }, {
            $pull: { participants: userId },
            $set: { updatedAt: new Date() },
        });
    }
}
//# sourceMappingURL=chat.service.js.map
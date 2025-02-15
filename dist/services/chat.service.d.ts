import { ChatMessage, ChatRoom } from '../types/chat.js';
export declare class ChatService {
    private static instance;
    private wsService;
    private constructor();
    static getInstance(): ChatService;
    createRoom(name: string, creatorId: ObjectId): Promise<ChatRoom>;
    getRoom(roomId: ObjectId): Promise<ChatRoom | null>;
    getRoomMessages(roomId: ObjectId, limit?: number, before?: Date): Promise<ChatMessage[]>;
    sendMessage(roomId: ObjectId, userId: ObjectId, content: string): Promise<ChatMessage>;
    addUserToRoom(roomId: ObjectId, userId: ObjectId): Promise<void>;
    removeUserFromRoom(roomId: ObjectId, userId: ObjectId): Promise<void>;
}

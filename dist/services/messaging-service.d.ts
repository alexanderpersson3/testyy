import { ObjectId } from 'mongodb';
import { Message, ConversationWithLastMessage } from '../types/messaging.js';
import { WebSocketService } from './websocket-service';
export declare class MessagingService {
    private wsService;
    constructor(wsService: WebSocketService);
    /**
     * Create a new conversation
     */
    createConversation(creatorId: string, participantIds: string[], options?: {
        isGroup?: boolean;
        groupName?: string;
        groupAvatar?: string;
    }): Promise<ObjectId>;
    /**
     * Send a message to a conversation
     */
    sendMessage(senderId: string, conversationId: string, text: string): Promise<ObjectId>;
    /**
     * Get user's conversations
     */
    getConversations(userId: string): Promise<ConversationWithLastMessage[]>;
    /**
     * Get messages for a conversation
     */
    getMessages(conversationId: string, userId: string, options?: {
        limit?: number;
        before?: Date;
    }): Promise<Message[]>;
    /**
     * Mark messages as read
     */
    markAsRead(userId: string, messageIds: string[]): Promise<void>;
    /**
     * Add members to a group conversation
     */
    addGroupMembers(conversationId: string, adminId: string, newMemberIds: string[]): Promise<void>;
    /**
     * Leave a conversation
     */
    leaveConversation(userId: string, conversationId: string): Promise<void>;
}
export default MessagingService;
//# sourceMappingURL=messaging-service.d.ts.map
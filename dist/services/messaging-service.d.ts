interface Message {
    _id?: ObjectId;
    conversationId: ObjectId;
    senderId: ObjectId;
    content: string;
    createdAt: Date;
    readAt?: Date;
}
interface Conversation {
    _id?: ObjectId;
    participants: ObjectId[];
    lastMessageAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}
export declare class MessagingService {
    private static instance;
    private wsService;
    private constructor();
    static getInstance(): MessagingService;
    createConversation(creatorId: ObjectId, participantIds: ObjectId[]): Promise<Conversation>;
    sendMessage(conversationId: ObjectId, senderId: ObjectId, content: string): Promise<Message>;
    getConversation(conversationId: ObjectId, userId: ObjectId): Promise<{
        conversation: Conversation;
        messages: Message[];
    }>;
    markAsRead(messageIds: ObjectId[], userId: ObjectId): Promise<void>;
    private getUserConversationIds;
}
export {};

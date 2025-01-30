import { ObjectId } from 'mongodb';
import { MessagingService } from '../messaging-service';
import { WebSocketService } from '../websocket-service';
import { Server } from 'http';
import { connectToDatabase } from '../../db/db';
jest.mock('../websocket-service', () => ({
    WebSocketService: jest.fn().mockImplementation(() => ({
        broadcast: jest.fn(),
        close: jest.fn(),
        sendToUser: jest.fn()
    }))
}));
describe('MessagingService', () => {
    let messagingService;
    let wsService;
    let server;
    const testUser1Id = '507f1f77bcf86cd799439011';
    const testUser2Id = '507f1f77bcf86cd799439012';
    beforeAll(async () => {
        server = new Server();
        wsService = new WebSocketService(server);
        messagingService = new MessagingService(wsService);
    });
    afterAll(async () => {
        server.close();
    });
    beforeEach(async () => {
        // Clear test database
        const db = await connectToDatabase();
        await db.collection('conversations').deleteMany({});
        await db.collection('conversation_members').deleteMany({});
        await db.collection('messages').deleteMany({});
        jest.clearAllMocks();
    });
    describe('getMessages', () => {
        it('should get messages for a conversation', async () => {
            const conversationId = await messagingService.createConversation(testUser1Id, [testUser2Id]);
            await messagingService.sendMessage(testUser1Id, conversationId.toString(), 'Hello!');
            await messagingService.sendMessage(testUser2Id, conversationId.toString(), 'Hi!');
            const messages = await messagingService.getMessages(conversationId.toString(), testUser1Id);
            expect(messages).toHaveLength(2);
            expect(messages[0].text).toBe('Hi!');
            expect(messages[1].text).toBe('Hello!');
        });
        it('should throw error if user is not in conversation', async () => {
            const conversationId = await messagingService.createConversation(testUser1Id, [testUser2Id]);
            const nonMemberId = '507f1f77bcf86cd799439013';
            await expect(messagingService.getMessages(conversationId.toString(), nonMemberId)).rejects.toThrow('User is not a member of this conversation');
        });
    });
    describe('createConversation', () => {
        it('should create a new conversation between two users', async () => {
            const conversationId = await messagingService.createConversation(testUser1Id, [testUser2Id]);
            expect(conversationId).toBeDefined();
            expect(ObjectId.isValid(conversationId.toString())).toBe(true);
            const db = await connectToDatabase();
            const conversation = await db.collection('conversations').findOne({
                _id: conversationId
            });
            expect(conversation).toBeDefined();
            expect(conversation?.participants).toHaveLength(2);
            expect(conversation?.participants.map((p) => p.toString())).toContain(testUser1Id);
            expect(conversation?.participants.map((p) => p.toString())).toContain(testUser2Id);
            expect(conversation?.isGroup).toBe(false);
            const members = await db.collection('conversation_members')
                .find({ conversationId })
                .toArray();
            expect(members).toHaveLength(2);
            expect(members.find(m => m.userId.toString() === testUser1Id)?.role).toBe('admin');
            expect(members.find(m => m.userId.toString() === testUser2Id)?.role).toBe('member');
            expect(wsService.sendToUser).toHaveBeenCalledWith(testUser2Id, expect.stringContaining('new_conversation'));
        });
        it('should return existing conversation for non-group chat', async () => {
            const conversationId1 = await messagingService.createConversation(testUser1Id, [testUser2Id]);
            const conversationId2 = await messagingService.createConversation(testUser2Id, [testUser1Id]);
            expect(conversationId1.toString()).toBe(conversationId2.toString());
        });
    });
    describe('sendMessage', () => {
        it('should send a message to a conversation', async () => {
            const conversationId = await messagingService.createConversation(testUser1Id, [testUser2Id]);
            const messageId = await messagingService.sendMessage(testUser1Id, conversationId.toString(), 'Hello!');
            expect(messageId).toBeDefined();
            expect(ObjectId.isValid(messageId.toString())).toBe(true);
            const db = await connectToDatabase();
            const message = await db.collection('messages').findOne({
                _id: messageId
            });
            expect(message).toBeDefined();
            expect(message?.senderId.toString()).toBe(testUser1Id);
            expect(message?.conversationId.toString()).toBe(conversationId.toString());
            expect(message?.text).toBe('Hello!');
            expect(message?.isRead).toBe(false);
            const conversation = await db.collection('conversations').findOne({
                _id: conversationId
            });
            expect(conversation?.lastMessageId?.toString()).toBe(messageId.toString());
            expect(conversation?.lastMessagePreview).toBe('Hello!');
            expect(wsService.broadcast).toHaveBeenCalledWith(expect.stringContaining('new_message'));
        });
        it('should throw error if user is not in conversation', async () => {
            const conversationId = await messagingService.createConversation(testUser1Id, [testUser2Id]);
            const nonMemberId = '507f1f77bcf86cd799439013';
            await expect(messagingService.sendMessage(nonMemberId, conversationId.toString(), 'Hello!')).rejects.toThrow('User is not a member of this conversation');
        });
    });
    describe('getConversations', () => {
        it('should get user conversations with unread count', async () => {
            const conversationId = await messagingService.createConversation(testUser1Id, [testUser2Id]);
            await messagingService.sendMessage(testUser2Id, conversationId.toString(), 'Hello!');
            const conversations = await messagingService.getConversations(testUser1Id);
            expect(conversations).toHaveLength(1);
            expect(conversations[0]._id?.toString()).toBe(conversationId.toString());
            expect(conversations[0].unreadCount).toBe(1);
            expect(conversations[0].lastMessage).toBeDefined();
            expect(conversations[0].lastMessage?.text).toBe('Hello!');
        });
    });
});
//# sourceMappingURL=messaging-service.test.js.map
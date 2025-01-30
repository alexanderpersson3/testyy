import { ObjectId } from 'mongodb';
import { connectToDatabase } from '../db/db.js';
import { Message, Conversation, ConversationMember, ConversationWithLastMessage } from '../types/messaging.js';
import { WebSocketService } from './websocket-service';

export class MessagingService {
  private wsService: WebSocketService;

  constructor(wsService: WebSocketService) {
    this.wsService = wsService;
  }

  /**
   * Create a new conversation
   */
  async createConversation(creatorId: string, participantIds: string[], options: {
    isGroup?: boolean;
    groupName?: string;
    groupAvatar?: string;
  } = {}): Promise<ObjectId> {
    const db = await connectToDatabase();

    // Ensure creator is included in participants
    const uniqueParticipants = [...new Set([creatorId, ...participantIds])];
    const participantObjectIds = uniqueParticipants.map(id => new ObjectId(id));

    // For non-group chats, check if conversation already exists
    if (!options.isGroup && participantObjectIds.length === 2) {
      const existingConversation = await db.collection<Conversation>('conversations')
        .findOne({
          participants: { $all: participantObjectIds },
          isGroup: false
        });

      if (existingConversation) {
        return existingConversation._id!;
      }
    }

    // Create new conversation
    const conversation: Omit<Conversation, '_id'> = {
      participants: participantObjectIds,
      isGroup: options.isGroup || false,
      groupName: options.groupName,
      groupAvatar: options.groupAvatar,
      createdBy: new ObjectId(creatorId),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await db.collection<Conversation>('conversations').insertOne(conversation);

    // Add conversation members
    const members: ConversationMember[] = participantObjectIds.map(userId => ({
      userId,
      conversationId: result.insertedId,
      role: userId.equals(new ObjectId(creatorId)) ? 'admin' : 'member',
      isMuted: false,
      joinedAt: new Date()
    }));

    await db.collection<ConversationMember>('conversation_members').insertMany(members);

    // Notify participants about new conversation
    participantIds.forEach(userId => {
      if (userId !== creatorId) {
        this.wsService.sendToUser(userId, JSON.stringify({
          type: 'new_conversation',
          conversationId: result.insertedId.toString(),
          createdBy: creatorId
        }));
      }
    });

    return result.insertedId;
  }

  /**
   * Send a message to a conversation
   */
  async sendMessage(senderId: string, conversationId: string, text: string): Promise<ObjectId> {
    const db = await connectToDatabase();

    // Verify sender is part of conversation
    const member = await db.collection<ConversationMember>('conversation_members').findOne({
      userId: new ObjectId(senderId),
      conversationId: new ObjectId(conversationId),
      leftAt: { $exists: false }
    });

    if (!member) {
      throw new Error('User is not a member of this conversation');
    }

    // Get conversation for receiver ID
    const conversation = await db.collection<Conversation>('conversations').findOne({
      _id: new ObjectId(conversationId)
    });

    if (!conversation) {
      throw new Error('Conversation not found');
    }

    // Create message
    const message: Omit<Message, '_id'> = {
      senderId: new ObjectId(senderId),
      receiverId: conversation.participants.find(p => !p.equals(new ObjectId(senderId)))!,
      conversationId: new ObjectId(conversationId),
      text,
      isRead: false,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await db.collection<Message>('messages').insertOne(message);

    // Update conversation with last message
    await db.collection('conversations').updateOne(
      { _id: new ObjectId(conversationId) },
      {
        $set: {
          lastMessageId: result.insertedId,
          lastMessagePreview: text.substring(0, 50) + (text.length > 50 ? '...' : ''),
          lastMessageAt: new Date(),
          updatedAt: new Date()
        }
      }
    );

    // Broadcast new message to conversation participants
    const newMessage = { ...message, _id: result.insertedId };
    this.wsService.broadcast(JSON.stringify({
      type: 'new_message',
      message: newMessage
    }));

    return result.insertedId;
  }

  /**
   * Get user's conversations
   */
  async getConversations(userId: string): Promise<ConversationWithLastMessage[]> {
    const db = await connectToDatabase();

    const result = await db.collection<Conversation>('conversations')
      .aggregate([
        {
          $match: {
            participants: new ObjectId(userId)
          }
        },
        {
          $lookup: {
            from: 'messages',
            localField: 'lastMessageId',
            foreignField: '_id',
            as: 'lastMessage'
          }
        },
        {
          $lookup: {
            from: 'messages',
            let: { conversationId: '$_id' },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ['$conversationId', '$$conversationId'] },
                      { $eq: ['$receiverId', new ObjectId(userId)] },
                      { $eq: ['$isRead', false] }
                    ]
                  }
                }
              },
              { $count: 'count' }
            ],
            as: 'unreadMessages'
          }
        },
        {
          $addFields: {
            lastMessage: { $arrayElemAt: ['$lastMessage', 0] },
            unreadCount: {
              $cond: {
                if: { $gt: [{ $size: '$unreadMessages' }, 0] },
                then: { $arrayElemAt: ['$unreadMessages.count', 0] },
                else: 0
              }
            }
          }
        },
        { $sort: { lastMessageAt: -1 } }
      ])
      .toArray() as unknown as ConversationWithLastMessage[];

    return result;
  }

  /**
   * Get messages for a conversation
   */
  async getMessages(conversationId: string, userId: string, options: {
    limit?: number;
    before?: Date;
  } = {}): Promise<Message[]> {
    const db = await connectToDatabase();

    // Verify user is part of conversation
    const member = await db.collection<ConversationMember>('conversation_members').findOne({
      userId: new ObjectId(userId),
      conversationId: new ObjectId(conversationId)
    });

    if (!member) {
      throw new Error('User is not a member of this conversation');
    }

    const query: any = {
      conversationId: new ObjectId(conversationId)
    };

    if (options.before) {
      query.createdAt = { $lt: options.before };
    }

    return await db.collection<Message>('messages')
      .find(query)
      .sort({ createdAt: -1 })
      .limit(options.limit || 50)
      .toArray();
  }

  /**
   * Mark messages as read
   */
  async markAsRead(userId: string, messageIds: string[]): Promise<void> {
    const db = await connectToDatabase();
    const messageObjectIds = messageIds.map(id => new ObjectId(id));

    const messages = await db.collection<Message>('messages').find({
      _id: { $in: messageObjectIds },
      receiverId: new ObjectId(userId),
      isRead: false
    }).toArray();

    if (messages.length > 0) {
      await db.collection('messages').updateMany(
        {
          _id: { $in: messageObjectIds },
          receiverId: new ObjectId(userId),
          isRead: false
        },
        {
          $set: {
            isRead: true,
            readAt: new Date()
          }
        }
      );

      // Notify message senders that their messages were read
      messages.forEach(message => {
        this.wsService.sendToUser(message.senderId.toString(), JSON.stringify({
          type: 'message_read',
          messageId: message._id.toString(),
          readBy: userId
        }));
      });
    }
  }

  /**
   * Add members to a group conversation
   */
  async addGroupMembers(conversationId: string, adminId: string, newMemberIds: string[]): Promise<void> {
    const db = await connectToDatabase();

    // Verify admin rights
    const admin = await db.collection<ConversationMember>('conversation_members').findOne({
      userId: new ObjectId(adminId),
      conversationId: new ObjectId(conversationId),
      role: 'admin'
    });

    if (!admin) {
      throw new Error('Only admins can add members to group conversations');
    }

    // Get conversation to verify it's a group
    const conversation = await db.collection<Conversation>('conversations').findOne({
      _id: new ObjectId(conversationId)
    });

    if (!conversation?.isGroup) {
      throw new Error('Members can only be added to group conversations');
    }

    // Add new members
    const newMembers: ConversationMember[] = newMemberIds.map(userId => ({
      userId: new ObjectId(userId),
      conversationId: new ObjectId(conversationId),
      role: 'member',
      isMuted: false,
      joinedAt: new Date()
    }));

    await db.collection<ConversationMember>('conversation_members').insertMany(newMembers);

    // Update conversation participants
    await db.collection('conversations').updateOne(
      { _id: new ObjectId(conversationId) },
      {
        $addToSet: {
          participants: {
            $each: newMemberIds.map(id => new ObjectId(id))
          }
        },
        $set: { updatedAt: new Date() }
      }
    );

    // Notify new members
    newMemberIds.forEach(userId => {
      this.wsService.sendToUser(userId, JSON.stringify({
        type: 'added_to_conversation',
        conversationId,
        addedBy: adminId
      }));
    });

    // Notify existing members
    this.wsService.broadcast(JSON.stringify({
      type: 'members_added',
      conversationId,
      newMembers: newMemberIds,
      addedBy: adminId
    }));
  }

  /**
   * Leave a conversation
   */
  async leaveConversation(userId: string, conversationId: string): Promise<void> {
    const db = await connectToDatabase();

    // Update member status
    await db.collection('conversation_members').updateOne(
      {
        userId: new ObjectId(userId),
        conversationId: new ObjectId(conversationId)
      },
      {
        $set: {
          leftAt: new Date()
        }
      }
    );

    // Remove from participants
    await db.collection('conversations').updateOne(
      { _id: new ObjectId(conversationId) },
      {
        $pull: { participants: new ObjectId(userId) } as any,
        $set: { updatedAt: new Date() }
      }
    );

    // Notify other members
    this.wsService.broadcast(JSON.stringify({
      type: 'member_left',
      conversationId,
      userId
    }));
  }
}

export default MessagingService; 

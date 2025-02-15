import { connectToDatabase } from '../db.js';;
import { WebSocketService } from '../websocket.service.js';;
import { ChatMessage, ChatRoom } from '../types/chat.js';;

export class ChatService {
  private static instance: ChatService;
  private wsService: WebSocketService;

  private constructor() {
    this.wsService = WebSocketService.getInstance();
  }

  static getInstance(): ChatService {
    if (!ChatService.instance) {
      ChatService.instance = new ChatService();
    }
    return ChatService.instance;
  }

  async createRoom(name: string, creatorId: ObjectId): Promise<ChatRoom> {
    const db = await connectToDatabase();

    const room: Omit<ChatRoom, '_id'> = {
      name,
      creatorId,
      participants: [creatorId],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await db.collection<ChatRoom>('chat_rooms').insertOne(room as ChatRoom);
    return {
      ...room,
      _id: result.insertedId,
    };
  }

  async getRoom(roomId: ObjectId): Promise<ChatRoom | null> {
    const db = await connectToDatabase();
    return db.collection<ChatRoom>('chat_rooms').findOne({ _id: roomId });
  }

  async getRoomMessages(
    roomId: ObjectId,
    limit: number = 50,
    before?: Date
  ): Promise<ChatMessage[]> {
    const db = await connectToDatabase();

    const query: { roomId: ObjectId; createdAt?: { $lt: Date } } = { roomId };
    if (before) {
      query.createdAt = { $lt: before };
    }

    return db
      .collection<ChatMessage>('chat_messages')
      .find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();
  }

  async sendMessage(roomId: ObjectId, userId: ObjectId, content: string): Promise<ChatMessage> {
    const db = await connectToDatabase();

    // Check if user is in room
    const room = await this.getRoom(roomId);
    if (!room || !room.participants.some((p: ObjectId) => p.equals(userId))) {
      throw new Error('User is not in room');
    }

    const message: Omit<ChatMessage, '_id'> = {
      roomId,
      userId,
      content,
      createdAt: new Date(),
    };

    const result = await db
      .collection<ChatMessage>('chat_messages')
      .insertOne(message as ChatMessage);
    const newMessage = {
      ...message,
      _id: result.insertedId,
    };

    // Notify room participants
    room.participants.forEach((participantId: ObjectId) => {
      if (!participantId.equals(userId)) {
        this.wsService.emitToUser(participantId, 'new_message', newMessage);
      }
    });

    return newMessage;
  }

  async addUserToRoom(roomId: ObjectId, userId: ObjectId): Promise<void> {
    const db = await connectToDatabase();

    await db.collection<ChatRoom>('chat_rooms').updateOne(
      { _id: roomId },
      {
        $addToSet: { participants: userId },
        $set: { updatedAt: new Date() },
      }
    );
  }

  async removeUserFromRoom(roomId: ObjectId, userId: ObjectId): Promise<void> {
    const db = await connectToDatabase();

    await db.collection<ChatRoom>('chat_rooms').updateOne(
      { _id: roomId },
      {
        $pull: { participants: userId },
        $set: { updatedAt: new Date() },
      }
    );
  }
}

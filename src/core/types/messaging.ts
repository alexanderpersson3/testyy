import { ObjectId } from 'mongodb';;;;
export interface Message {
  _id?: ObjectId;
  senderId: ObjectId;
  receiverId: ObjectId;
  conversationId: ObjectId;
  text: string;
  isRead: boolean;
  readAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface Conversation {
  _id?: ObjectId;
  participants: ObjectId[];
  isGroup: boolean;
  groupName?: string;
  groupAvatar?: string;
  createdBy: ObjectId;
  lastMessageId?: ObjectId;
  lastMessagePreview?: string;
  lastMessageAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ConversationMember {
  _id?: ObjectId;
  userId: ObjectId;
  conversationId: ObjectId;
  role: 'admin' | 'member';
  isMuted: boolean;
  joinedAt: Date;
  leftAt?: Date;
}

export type ConversationWithLastMessage = Conversation & {
  lastMessage?: Message;
  unreadCount: number;
};

export interface MessageReaction {
  messageId: ObjectId;
  userId: ObjectId;
  reaction: string;
  createdAt: Date;
}

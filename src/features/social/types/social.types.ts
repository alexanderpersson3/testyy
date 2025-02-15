import { ObjectId } from 'mongodb';
import type { MongoDocument } from '../../../core/database/types/mongodb.types.js';

export interface Comment extends MongoDocument {
  userId: ObjectId;
  targetId: ObjectId;
  targetType: 'recipe' | 'user' | 'article';
  content: string;
  likes: number;
  replies: ObjectId[];
  isEdited: boolean;
  parentId?: ObjectId;
  status: 'active' | 'hidden' | 'deleted';
}

export interface Like extends MongoDocument {
  userId: ObjectId;
  targetId: ObjectId;
  targetType: 'recipe' | 'comment' | 'article';
}

export interface Share extends MongoDocument {
  userId: ObjectId;
  targetId: ObjectId;
  targetType: 'recipe' | 'article';
  platform: 'facebook' | 'twitter' | 'pinterest' | 'email';
  metadata?: {
    url: string;
    title: string;
    description: string;
    image?: string;
  };
}

export interface Follow extends MongoDocument {
  followerId: ObjectId;
  followedId: ObjectId;
  status: 'pending' | 'accepted' | 'blocked';
}

export interface Activity extends MongoDocument {
  userId: ObjectId;
  type: 'comment' | 'like' | 'share' | 'follow';
  targetId: ObjectId;
  targetType: 'recipe' | 'user' | 'comment' | 'article';
  metadata?: Record<string, unknown>;
}

export interface Notification extends MongoDocument {
  userId: ObjectId;
  type: 'comment' | 'like' | 'share' | 'follow' | 'mention';
  actorId: ObjectId;
  targetId: ObjectId;
  targetType: 'recipe' | 'user' | 'comment' | 'article';
  status: 'unread' | 'read' | 'archived';
  metadata?: Record<string, unknown>;
}

export type CreateCommentDTO = Omit<Comment, keyof MongoDocument>;
export type UpdateCommentDTO = Partial<Omit<Comment, keyof MongoDocument | 'userId'>>;

export type CreateShareDTO = Omit<Share, keyof MongoDocument>;
export type UpdateShareDTO = Partial<Omit<Share, keyof MongoDocument | 'userId'>>;

export type CreateNotificationDTO = Omit<Notification, keyof MongoDocument>;
export type UpdateNotificationDTO = Partial<Omit<Notification, keyof MongoDocument | 'userId'>>; 
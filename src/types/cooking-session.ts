import { ObjectId } from 'mongodb';

export type Visibility = 'public' | 'followers' | 'private';

export interface CookingSession {
  _id?: ObjectId;
  userId: ObjectId;
  title: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  photos: string[];  // URLs to photos
  visibility: Visibility;
  likeCount: number;
  commentCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CookingSessionLike {
  _id?: ObjectId;
  sessionId: ObjectId;
  userId: ObjectId;
  createdAt: Date;
}

export interface CookingSessionComment {
  _id?: ObjectId;
  sessionId: ObjectId;
  userId: ObjectId;
  text: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateCookingSessionDto {
  title: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  photos?: string[];
  visibility?: Visibility;
}

export interface UpdateCookingSessionDto {
  title?: string;
  description?: string;
  startTime?: Date;
  endTime?: Date;
  photos?: string[];
  visibility?: Visibility;
}

export interface CookingSessionWithUser extends CookingSession {
  user: {
    _id: ObjectId;
    name: string;
    avatar?: string;
  };
  isLiked?: boolean;
}

export interface CookingSessionFeedParams {
  limit?: number;
  offset?: number;
  userId?: string;  // For filtering by specific user
  following?: boolean;  // For filtering by followed users only
  visibility?: Visibility;
} 
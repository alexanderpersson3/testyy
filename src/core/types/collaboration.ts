import { ObjectId } from 'mongodb';;;;
export type ResourceType = 'recipe' | 'collection' | 'cooking_session';

export interface CollaborationParticipant {
  userId: ObjectId;
  sessionId: string;
  joinedAt: Date;
  lastActiveAt: Date;
}

export interface CollaborationOperation {
  type: 'update' | 'delete' | 'create';
  path: string;
  value?: any;
}

export interface CollaborationChange {
  userId: ObjectId;
  resourceId: ObjectId;
  resourceType: ResourceType;
  operation: CollaborationOperation;
  timestamp: Date;
}

export interface CollaborationSession {
  _id?: ObjectId;
  resourceId: ObjectId;
  resourceType: ResourceType;
  participants: CollaborationParticipant[];
  changes: Array<{
    userId: ObjectId;
    timestamp: Date;
    operation: CollaborationOperation;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

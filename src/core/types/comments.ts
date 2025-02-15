import { ObjectId } from 'mongodb';;;;
export interface Comment {
  _id?: ObjectId;
  recipeId: ObjectId;
  userId: ObjectId;
  parentId?: ObjectId;
  text: string;
  score: number;
  isEdited: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CommentVote {
  _id?: ObjectId;
  commentId: ObjectId;
  userId: ObjectId;
  value: 1 | -1;
  createdAt: Date;
}

export interface CommentWithUser extends Comment {
  user: {
    _id: ObjectId;
    name: string;
    avatar?: string;
  };
  userVote?: 1 | -1;
  replies?: CommentWithUser[];
}

export interface CreateCommentDTO {
  text: string;
  parentId?: string;
}

export interface UpdateCommentDTO {
  text: string;
}

export type CommentSortType = 'best' | 'new' | 'old' | 'controversial';

import { ObjectId } from 'mongodb';;;;
export interface Vote {
  userId: ObjectId;
  value: 1 | -1;
  createdAt: Date;
  updatedAt: Date;
}

export interface BaseComment {
  recipeId: ObjectId;
  userId: ObjectId;
  parentId?: ObjectId; // If null/undefined, it's a top-level comment
  text: string;
  score: number; // Sum of upvotes and downvotes
  votes: Record<string, Vote>; // userId -> Vote
  isEdited: boolean;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
  userVote?: 1 | -1 | null; // The current user's vote on this comment
}

export interface Comment extends BaseComment {
  _id?: ObjectId;
}

export interface CommentDocument extends BaseComment {
  _id: ObjectId;
}

export interface CommentTree extends CommentDocument {
  user?: {
    _id: ObjectId;
    username: string;
    avatar?: string;
  };
  children: CommentTree[];
}

export interface CreateCommentDTO {
  content: string;
  recipeId: string;
  parentId?: string;
}

export interface UpdateCommentDTO {
  content: string;
}

export type SortType = 'best' | 'top' | 'new' | 'old' | 'controversial';

export interface CommentQuery {
  recipeId: string;
  parentId?: string;
  sort?: SortType;
  limit?: number;
  offset?: number;
}

export interface CommentVoteDTO {
  value: 1 | -1;
}

export interface VoteCommentDTO {
  vote: 'up' | 'down';
}

export type CommentSortType = 'new' | 'top' | 'controversial';

export interface CommentFilters {
  sort?: CommentSortType;
  limit?: number;
  offset?: number;
}

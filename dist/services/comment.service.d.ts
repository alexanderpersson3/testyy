import { ObjectId } from 'mongodb';
import type { Comment } from '../types/index.js';
export interface CommentServiceInterface {
    createComment(userId: ObjectId, recipeId: ObjectId, text: string, parentId?: ObjectId): Promise<Comment>;
    getComment(commentId: ObjectId): Promise<Comment | null>;
    getComments(recipeId: ObjectId, userId?: ObjectId, options?: {
        parentId?: ObjectId | null;
        limit?: number;
        offset?: number;
    }): Promise<Comment[]>;
    updateComment(commentId: ObjectId, userId: ObjectId, text: string): Promise<boolean>;
    voteComment(commentId: ObjectId, userId: ObjectId, value: 1 | -1): Promise<void>;
}
export declare class CommentService implements CommentServiceInterface {
    private static instance;
    private initialized;
    private db;
    private commentsCollection;
    private ws;
    private constructor();
    private initialize;
    private ensureInitialized;
    static getInstance(): CommentService;
    createComment(userId: ObjectId, recipeId: ObjectId, text: string, parentId?: ObjectId): Promise<Comment>;
    getComment(commentId: ObjectId): Promise<Comment | null>;
    getComments(recipeId: ObjectId, userId?: ObjectId, options?: {
        parentId?: ObjectId | null;
        limit?: number;
        offset?: number;
    }): Promise<Comment[]>;
    updateComment(commentId: ObjectId, userId: ObjectId, text: string): Promise<boolean>;
    voteComment(commentId: ObjectId, userId: ObjectId, value: 1 | -1): Promise<void>;
    deleteComment(commentId: ObjectId, userId: ObjectId): Promise<boolean>;
    getCommentReplies(commentId: ObjectId, options?: {
        limit?: number;
        offset?: number;
    }): Promise<Comment[]>;
    getCommentCount(recipeId: ObjectId): Promise<number>;
    private getChildren;
    private buildCommentTree;
}

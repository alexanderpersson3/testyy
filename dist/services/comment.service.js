import { ObjectId } from 'mongodb';
;
import { Db } from 'mongodb';
import { connectToDatabase } from '../db/database.service.js';
import { InternalServerError as DbError, NotFoundError as NotFound } from '../types/errors.js';
import logger from '../utils/logger.js';
import { WebSocketService } from './websocket-service.js';
export class CommentService {
    constructor() {
        this.initialized = false;
        this.initialize().catch(error => {
            logger.error('Failed to initialize CommentService:', error);
        });
        this.ws = WebSocketService.getInstance();
    }
    async initialize() {
        if (this.initialized)
            return;
        try {
            this.db = await connectToDatabase();
            this.commentsCollection = this.db.collection('comments');
            this.initialized = true;
        }
        catch (error) {
            logger.error('Failed to initialize CommentService:', error);
            throw new DbError('Failed to initialize CommentService');
        }
    }
    async ensureInitialized() {
        if (!this.initialized) {
            await this.initialize();
        }
    }
    static getInstance() {
        if (!CommentService.instance) {
            CommentService.instance = new CommentService();
        }
        return CommentService.instance;
    }
    async createComment(userId, recipeId, text, parentId) {
        await this.ensureInitialized();
        try {
            if (parentId) {
                const parentComment = await this.getComment(parentId);
                if (!parentComment) {
                    throw new NotFound('Parent comment not found');
                }
            }
            const baseComment = {
                userId,
                recipeId,
                text,
                ...(parentId && { parentId }),
                score: 0,
                votes: {},
                isEdited: false,
                isDeleted: false,
                createdAt: new Date(),
                updatedAt: new Date(),
            };
            const result = await this.commentsCollection.insertOne({
                ...baseComment,
                _id: new ObjectId(),
            });
            return {
                ...baseComment,
                _id: result.insertedId,
            };
        }
        catch (error) {
            if (error instanceof NotFound)
                throw error;
            logger.error('Failed to create comment:', error);
            throw new DbError('Failed to create comment');
        }
    }
    async getComment(commentId) {
        await this.ensureInitialized();
        try {
            return this.commentsCollection.findOne({ _id: commentId });
        }
        catch (error) {
            logger.error('Failed to get comment:', error);
            throw new DbError('Failed to get comment');
        }
    }
    async getComments(recipeId, userId, options = {}) {
        await this.ensureInitialized();
        try {
            const baseFilter = {
                recipeId,
                ...(options.parentId !== undefined && {
                    parentId: options.parentId === null ? { $exists: false } : options.parentId
                })
            };
            const comments = await this.commentsCollection
                .find(baseFilter)
                .sort({ createdAt: -1 })
                .skip(options.offset || 0)
                .limit(options.limit || 50)
                .toArray();
            if (userId) {
                comments.forEach(comment => {
                    const userVote = comment.votes[userId.toString()];
                    comment.userVote = userVote ? userVote.value : null;
                });
            }
            return this.buildCommentTree(comments);
        }
        catch (error) {
            logger.error('Failed to get comments:', error);
            throw new DbError('Failed to get comments');
        }
    }
    async updateComment(commentId, userId, text) {
        await this.ensureInitialized();
        try {
            const comment = await this.getComment(commentId);
            if (!comment) {
                throw new NotFound('Comment not found');
            }
            if (!comment.userId.equals(userId)) {
                throw new Error('Unauthorized: User does not own this comment');
            }
            const result = await this.commentsCollection.updateOne({ _id: commentId }, {
                $set: {
                    text,
                    isEdited: true,
                    updatedAt: new Date(),
                },
            });
            // Notify WebSocket clients
            await this.ws.broadcast('comment_updated', {
                recipeId: comment.recipeId.toString(),
                comment: comment,
            });
            return result.modifiedCount > 0;
        }
        catch (error) {
            if (error instanceof NotFound)
                throw error;
            logger.error('Failed to update comment:', error);
            throw new DbError('Failed to update comment');
        }
    }
    async voteComment(commentId, userId, value) {
        await this.ensureInitialized();
        try {
            const comment = await this.getComment(commentId);
            if (!comment) {
                throw new NotFound('Comment not found');
            }
            const userIdStr = userId.toString();
            const existingVote = comment.votes[userIdStr];
            if (existingVote) {
                if (existingVote.value === value) {
                    // Remove vote if same value
                    await this.commentsCollection.updateOne({ _id: commentId }, {
                        $unset: { [`votes.${userIdStr}`]: '' },
                        $inc: { score: -value },
                        $set: {
                            updatedAt: new Date(),
                            userVote: null,
                        },
                    });
                }
                else {
                    // Update vote if different value
                    const vote = {
                        userId,
                        value,
                        createdAt: existingVote.createdAt,
                        updatedAt: new Date(),
                    };
                    await this.commentsCollection.updateOne({ _id: commentId }, {
                        $set: {
                            [`votes.${userIdStr}`]: vote,
                            updatedAt: new Date(),
                            userVote: value,
                        },
                        $inc: { score: value * 2 },
                    });
                }
            }
            else {
                // Create new vote
                const vote = {
                    userId,
                    value,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                };
                await this.commentsCollection.updateOne({ _id: commentId }, {
                    $set: {
                        [`votes.${userIdStr}`]: vote,
                        updatedAt: new Date(),
                        userVote: value,
                    },
                    $inc: { score: value },
                });
            }
            // Notify WebSocket clients
            await this.ws.broadcast('comment_voted', {
                recipeId: comment.recipeId.toString(),
                comment: comment,
            });
        }
        catch (error) {
            if (error instanceof NotFound)
                throw error;
            logger.error('Failed to vote on comment:', error);
            throw new DbError('Failed to vote on comment');
        }
    }
    async deleteComment(commentId, userId) {
        await this.ensureInitialized();
        try {
            const comment = await this.getComment(commentId);
            if (!comment) {
                throw new NotFound('Comment not found');
            }
            if (!comment.userId.equals(userId)) {
                throw new Error('Unauthorized: User does not own this comment');
            }
            const result = await this.commentsCollection.updateOne({ _id: commentId }, {
                $set: {
                    isDeleted: true,
                    updatedAt: new Date(),
                },
            });
            // Notify WebSocket clients
            await this.ws.broadcast('comment_deleted', {
                recipeId: comment.recipeId.toString(),
                commentId: commentId.toString(),
            });
            return result.modifiedCount > 0;
        }
        catch (error) {
            if (error instanceof NotFound)
                throw error;
            logger.error('Failed to delete comment:', error);
            throw new DbError('Failed to delete comment');
        }
    }
    async getCommentReplies(commentId, options = {}) {
        await this.ensureInitialized();
        try {
            return this.commentsCollection
                .find({ parentId: commentId, isDeleted: false })
                .sort({ createdAt: -1 })
                .skip(options.offset || 0)
                .limit(options.limit || 50)
                .toArray();
        }
        catch (error) {
            logger.error('Failed to get comment replies:', error);
            throw new DbError('Failed to get comment replies');
        }
    }
    async getCommentCount(recipeId) {
        await this.ensureInitialized();
        try {
            return this.commentsCollection.countDocuments({
                recipeId,
                isDeleted: false,
            });
        }
        catch (error) {
            logger.error('Failed to get comment count:', error);
            throw new DbError('Failed to get comment count');
        }
    }
    async getChildren(commentId) {
        await this.ensureInitialized();
        try {
            const children = await this.commentsCollection
                .find({ parentId: commentId, isDeleted: false })
                .toArray();
            const childIds = children.map(c => c._id);
            const grandChildIds = await Promise.all(children.map(comment => this.getChildren(comment._id)));
            return [...childIds, ...grandChildIds.flat()];
        }
        catch (error) {
            logger.error('Failed to get comment children:', error);
            throw new DbError('Failed to get comment children');
        }
    }
    buildCommentTree(comments) {
        const commentMap = new Map();
        const rootComments = [];
        // First pass: Create a map of all comments
        comments.forEach(comment => {
            if (comment._id) {
                commentMap.set(comment._id.toString(), { ...comment, replies: [] });
            }
        });
        // Second pass: Build the tree structure
        comments.forEach(comment => {
            if (!comment._id)
                return;
            const commentWithReplies = commentMap.get(comment._id.toString());
            if (!commentWithReplies)
                return;
            if (comment.parentId) {
                const parent = commentMap.get(comment.parentId.toString());
                if (parent) {
                    parent.replies.push(commentWithReplies);
                }
            }
            else {
                rootComments.push(commentWithReplies);
            }
        });
        return rootComments;
    }
}
//# sourceMappingURL=comment.service.js.map
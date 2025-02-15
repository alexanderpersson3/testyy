import express from 'express';
import { z } from 'zod';
import { ObjectId } from 'mongodb';
;
import { auth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { CommentService } from '../services/comment.service.js';
import { NotFoundError, ForbiddenError } from '../utils/errors.js';
const router = express.Router();
const commentService = CommentService.getInstance();
// Validation schemas
const createCommentSchema = z.object({
    content: z.string().min(1).max(1000),
    recipeId: z.string().regex(/^[0-9a-fA-F]{24}$/),
    parentId: z.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
});
const updateCommentSchema = z.object({
    content: z.string().min(1).max(1000),
});
const voteCommentSchema = z.object({
    vote: z.enum(['up', 'down']),
});
const getCommentsQuerySchema = z.object({
    sort: z.enum(['new', 'top', 'controversial']).optional(),
    limit: z.coerce.number().min(1).max(100).optional(),
    offset: z.coerce.number().min(0).optional(),
    parentId: z.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
});
// Routes
router.post('/', auth, validate(createCommentSchema), async (req, res, next) => {
    try {
        const comment = await commentService.createComment(new ObjectId(req.user.id), new ObjectId(req.body.recipeId), req.body.content, req.body.parentId ? new ObjectId(req.body.parentId) : undefined);
        res.status(201).json(comment);
    }
    catch (error) {
        next(error);
    }
});
router.get('/recipe/:recipeId', validate(getCommentsQuerySchema, 'query'), async (req, res, next) => {
    try {
        const options = {
            parentId: req.query.parentId ? new ObjectId(req.query.parentId) : undefined,
            limit: req.query.limit ? Number(req.query.limit) : undefined,
            offset: req.query.offset ? Number(req.query.offset) : undefined,
        };
        const comments = await commentService.getComments(new ObjectId(req.params.recipeId), req.user ? new ObjectId(req.user.id) : undefined, options);
        res.json(comments);
    }
    catch (error) {
        if (error instanceof Error) {
            res.status(400).json({ error: error.message });
        }
        else {
            next(error);
        }
    }
});
router.patch('/:commentId', auth, validate(updateCommentSchema), async (req, res, next) => {
    try {
        const comment = await commentService.updateComment(new ObjectId(req.user.id), new ObjectId(req.params.commentId), req.body);
        res.json(comment);
    }
    catch (error) {
        if (error instanceof NotFoundError || error instanceof ForbiddenError) {
            res.status(error instanceof NotFoundError ? 404 : 403).json({
                error: error.message,
            });
        }
        else {
            next(error);
        }
    }
});
router.delete('/:commentId', auth, async (req, res, next) => {
    try {
        await commentService.deleteComment(new ObjectId(req.user.id), new ObjectId(req.params.commentId));
        res.status(204).send();
    }
    catch (error) {
        if (error instanceof NotFoundError || error instanceof ForbiddenError) {
            res.status(error instanceof NotFoundError ? 404 : 403).json({
                error: error.message,
            });
        }
        else {
            next(error);
        }
    }
});
router.post('/:commentId/vote', auth, validate(voteCommentSchema), async (req, res, next) => {
    try {
        const comment = await commentService.voteComment(new ObjectId(req.user.id), new ObjectId(req.params.commentId), req.body);
        res.json(comment);
    }
    catch (error) {
        if (error instanceof NotFoundError) {
            res.status(404).json({ error: error.message });
        }
        else {
            next(error);
        }
    }
});
export default router;
//# sourceMappingURL=comments.js.map
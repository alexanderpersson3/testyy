import { Request, Response } from 'express';
import { ObjectId } from 'mongodb';
import { socialService } from '../services/social.service.js';
import { ValidationError } from '../../../core/errors/index.js';
import type { CreateCommentDTO, UpdateCommentDTO, CreateShareDTO } from '../types/social.types.js';

export class SocialController {
  async createComment(req: Request, res: Response): Promise<void> {
    const userId = new ObjectId(req.user?._id);
    const data: CreateCommentDTO = {
      ...req.body,
      userId,
      targetId: new ObjectId(req.body.targetId)
    };

    const comment = await socialService.createComment(data);
    res.status(201).json({ success: true, data: comment });
  }

  async updateComment(req: Request, res: Response): Promise<void> {
    const commentId = new ObjectId(req.params.id);
    const userId = new ObjectId(req.user?._id);
    const data: UpdateCommentDTO = req.body;

    const comment = await socialService.getComment(commentId);
    if (!comment.userId.equals(userId)) {
      throw new ValidationError('Not authorized to update this comment');
    }

    const updatedComment = await socialService.updateComment(commentId, data);
    res.json({ success: true, data: updatedComment });
  }

  async deleteComment(req: Request, res: Response): Promise<void> {
    const commentId = new ObjectId(req.params.id);
    const userId = new ObjectId(req.user?._id);

    const comment = await socialService.getComment(commentId);
    if (!comment.userId.equals(userId)) {
      throw new ValidationError('Not authorized to delete this comment');
    }

    await socialService.deleteComment(commentId);
    res.json({ success: true });
  }

  async toggleLike(req: Request, res: Response): Promise<void> {
    const userId = new ObjectId(req.user?._id);
    const targetId = new ObjectId(req.params.id);
    const { targetType } = req.body;

    const isLiked = await socialService.toggleLike(userId, targetId, targetType);
    res.json({ success: true, data: { isLiked } });
  }

  async createShare(req: Request, res: Response): Promise<void> {
    const userId = new ObjectId(req.user?._id);
    const data: CreateShareDTO = {
      ...req.body,
      userId,
      targetId: new ObjectId(req.body.targetId)
    };

    const share = await socialService.createShare(data);
    res.status(201).json({ success: true, data: share });
  }

  async toggleFollow(req: Request, res: Response): Promise<void> {
    const followerId = new ObjectId(req.user?._id);
    const followedId = new ObjectId(req.params.id);

    const isFollowing = await socialService.toggleFollow(followerId, followedId);
    res.json({ success: true, data: { isFollowing } });
  }

  async getCommentsByTarget(req: Request, res: Response): Promise<void> {
    const targetId = new ObjectId(req.params.id);
    const { targetType } = req.query;
    const { page = 1, limit = 10 } = req.query;

    const comments = await socialService.getCommentsByTarget(
      targetId,
      targetType as any,
      { page: Number(page), limit: Number(limit) }
    );

    res.json({ success: true, data: comments });
  }

  async getNotifications(req: Request, res: Response): Promise<void> {
    const userId = new ObjectId(req.user?._id);
    const { page = 1, limit = 10 } = req.query;

    const notifications = await socialService.getNotifications(
      userId,
      { page: Number(page), limit: Number(limit) }
    );

    res.json({ success: true, data: notifications });
  }

  async getFollowers(req: Request, res: Response): Promise<void> {
    const userId = new ObjectId(req.params.id);
    const { page = 1, limit = 10 } = req.query;

    const followers = await socialService.getFollowers(
      userId,
      { page: Number(page), limit: Number(limit) }
    );

    res.json({ success: true, data: followers });
  }

  async getFollowing(req: Request, res: Response): Promise<void> {
    const userId = new ObjectId(req.params.id);
    const { page = 1, limit = 10 } = req.query;

    const following = await socialService.getFollowing(
      userId,
      { page: Number(page), limit: Number(limit) }
    );

    res.json({ success: true, data: following });
  }
}

// Export singleton instance
export const socialController = new SocialController(); 
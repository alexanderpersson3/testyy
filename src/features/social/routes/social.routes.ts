import { Router } from 'express';
import { socialController } from '../controllers/social.controller.js';
import { validateRequest } from '../../../core/middleware/validate-request.js';
import { authenticate } from '../../../core/middleware/authenticate.js';
import {
  createCommentSchema,
  updateCommentSchema,
  toggleLikeSchema,
  createShareSchema,
  getCommentsByTargetSchema,
  paginationSchema
} from '../schemas/social.schema.js';

const router = Router();

// Comment routes
router.post(
  '/comments',
  authenticate,
  validateRequest({ body: createCommentSchema }),
  socialController.createComment
);

router.put(
  '/comments/:id',
  authenticate,
  validateRequest({ body: updateCommentSchema }),
  socialController.updateComment
);

router.delete(
  '/comments/:id',
  authenticate,
  socialController.deleteComment
);

router.get(
  '/comments/target/:id',
  validateRequest({ query: getCommentsByTargetSchema }),
  socialController.getCommentsByTarget
);

// Like routes
router.post(
  '/likes/:id',
  authenticate,
  validateRequest({ body: toggleLikeSchema }),
  socialController.toggleLike
);

// Share routes
router.post(
  '/shares',
  authenticate,
  validateRequest({ body: createShareSchema }),
  socialController.createShare
);

// Follow routes
router.post(
  '/follows/:id',
  authenticate,
  socialController.toggleFollow
);

router.get(
  '/follows/:id/followers',
  validateRequest({ query: paginationSchema }),
  socialController.getFollowers
);

router.get(
  '/follows/:id/following',
  validateRequest({ query: paginationSchema }),
  socialController.getFollowing
);

// Notification routes
router.get(
  '/notifications',
  authenticate,
  validateRequest({ query: paginationSchema }),
  socialController.getNotifications
);

export default router; 
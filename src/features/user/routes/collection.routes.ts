import { Router } from 'express';;
import type { Recipe } from '../types/express.js';
import type { Response, NextFunction } from '../types/express.js';
import type { body, param, validationResult } from '../types/express.js';;
import type { CollectionService } from '../types/express.js';
import { ObjectId } from 'mongodb';;;;
import { asyncHandler } from '../utils/asyncHandler.js';;
import { auth } from '../middleware/auth.js';;
import { DatabaseError, ValidationError } from '../utils/errors.js';;
import logger from '../utils/logger.js';
import type { AuthenticatedRequest, SuccessResponse, DocumentResponse, ErrorResponse } from '../types/express.js';
import { AuthenticatedRouteHandler, RouteParams } from '../types/route.js';;
import { createAuthenticatedRouter } from '../utils/router.js';;

const router = createAuthenticatedRouter();
const collectionService = new CollectionService();

// Types for collection routes
type CollectionParams = RouteParams<'collectionId'>;
type CollectionRecipeParams = RouteParams<'collectionId' | 'recipeId'>;

interface CreateCollectionBody {
  name: string;
  description?: string;
  coverImage?: string;
  isPublic?: boolean;
}

interface UpdateCollectionBody {
  name?: string;
  description?: string;
  coverImage?: string;
  isPublic?: boolean;
}

interface RecipeNotesBody {
  notes: string;
}

interface ReorderRecipesBody {
  recipeOrders: Array<{
    recipeId: string;
    order: number;
  }>;
}

// Validation middleware
const validate: AuthenticatedRouteHandler = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return;
  }
  next();
};

// Create a collection
router.post(
  '/',
  auth,
  [
    body('name').isString().notEmpty().withMessage('Name is required'),
    body('description').optional().isString(),
    body('coverImage').optional().isString(),
    body('isPublic').optional().isBoolean(),
  ],
  validate,
  asyncHandler(async (req: AuthenticatedRequest<{}, any, CreateCollectionBody>, res: Response) => {
    if (!req.user) {
      throw new ValidationError('Authentication required');
    }

    try {
      const collection = await collectionService.createCollection({
        name: req.body.name,
        description: req.body.description,
        coverImage: req.body.coverImage,
        owner: new ObjectId(req.user.id),
        collaborators: [],
        recipes: [],
        isPublic: req.body.isPublic ?? false,
      });

      res.json(collection);
    } catch (error) {
      logger.error('Failed to create collection:', error);
      throw new DatabaseError('Failed to create collection');
    }
  })
);

// Get a collection
router.get(
  '/:collectionId',
  auth,
  [param('collectionId').isString().notEmpty()],
  validate,
  asyncHandler(async (req: AuthenticatedRequest<CollectionParams>, res: Response) => {
    if (!req.user) {
      throw new ValidationError('Authentication required');
    }

    try {
      const collection = await collectionService.getCollection(
        new ObjectId(req.params.collectionId),
        new ObjectId(req.user.id)
      );
      if (!collection) {
        return res.status(404).json({ error: 'Collection not found' });
      }
      res.json(collection);
    } catch (error) {
      logger.error('Failed to get collection:', error);
      throw new DatabaseError('Failed to get collection');
    }
  })
);

// Update a collection
router.put(
  '/:collectionId',
  auth,
  [
    param('collectionId').isString().notEmpty(),
    body('name').optional().isString(),
    body('description').optional().isString(),
    body('coverImage').optional().isString(),
    body('isPublic').optional().isBoolean(),
  ],
  validate,
  asyncHandler(async (req: AuthenticatedRequest<CollectionParams, any, UpdateCollectionBody>, res: Response) => {
    if (!req.user) {
      throw new ValidationError('Authentication required');
    }

    try {
      const success = await collectionService.updateCollection(
        new ObjectId(req.params.collectionId),
        new ObjectId(req.user.id),
        {
          name: req.body.name,
          description: req.body.description,
          coverImage: req.body.coverImage,
          isPublic: req.body.isPublic,
        }
      );
      if (!success) {
        return res.status(404).json({ error: 'Collection not found or unauthorized' });
      }
      res.json({ success: true });
    } catch (error) {
      logger.error('Failed to update collection:', error);
      throw new DatabaseError('Failed to update collection');
    }
  })
);

// Delete a collection
router.delete(
  '/:collectionId',
  auth,
  [param('collectionId').isString().notEmpty()],
  validate,
  asyncHandler(async (req: AuthenticatedRequest<CollectionParams>, res: Response) => {
    if (!req.user) {
      throw new ValidationError('Authentication required');
    }

    try {
      const success = await collectionService.deleteCollection(
        new ObjectId(req.params.collectionId),
        new ObjectId(req.user.id)
      );
      if (!success) {
        return res.status(404).json({ error: 'Collection not found or unauthorized' });
      }
      res.json({ success: true });
    } catch (error) {
      logger.error('Failed to delete collection:', error);
      throw new DatabaseError('Failed to delete collection');
    }
  })
);

// Add a recipe to a collection
router.post(
  '/:collectionId/recipes/:recipeId',
  auth,
  [
    param('collectionId').isString().notEmpty(),
    param('recipeId').isString().notEmpty(),
    body('notes').optional().isString(),
  ],
  validate,
  asyncHandler(async (req: AuthenticatedRequest<CollectionRecipeParams>, res: Response) => {
    if (!req.user) {
      throw new ValidationError('Authentication required');
    }

    try {
      const success = await collectionService.addRecipe(
        new ObjectId(req.params.collectionId),
        new ObjectId(req.user.id),
        new ObjectId(req.params.recipeId),
        req.body.notes
      );
      if (!success) {
        return res.status(404).json({ error: 'Collection not found or unauthorized' });
      }
      res.json({ success: true });
    } catch (error) {
      logger.error('Failed to add recipe to collection:', error);
      throw new DatabaseError('Failed to add recipe to collection');
    }
  })
);

// Remove a recipe from a collection
router.delete(
  '/:collectionId/recipes/:recipeId',
  auth,
  [
    param('collectionId').isString().notEmpty(),
    param('recipeId').isString().notEmpty(),
  ],
  validate,
  asyncHandler(async (req: AuthenticatedRequest<CollectionRecipeParams>, res: Response) => {
    if (!req.user) {
      throw new ValidationError('Authentication required');
    }

    try {
      const success = await collectionService.removeRecipe(
        new ObjectId(req.params.collectionId),
        new ObjectId(req.user.id),
        new ObjectId(req.params.recipeId)
      );
      if (!success) {
        return res.status(404).json({ error: 'Collection not found or unauthorized' });
      }
      res.json({ success: true });
    } catch (error) {
      logger.error('Failed to remove recipe from collection:', error);
      throw new DatabaseError('Failed to remove recipe from collection');
    }
  })
);

// Update recipe notes
router.put(
  '/:collectionId/recipes/:recipeId/notes',
  auth,
  [
    param('collectionId').isString().notEmpty(),
    param('recipeId').isString().notEmpty(),
    body('notes').isString().notEmpty(),
  ],
  validate,
  asyncHandler(async (req: AuthenticatedRequest<CollectionRecipeParams, any, RecipeNotesBody>, res: Response) => {
    if (!req.user) {
      throw new ValidationError('Authentication required');
    }

    try {
      const success = await collectionService.updateRecipeNotes(
        new ObjectId(req.params.collectionId),
        new ObjectId(req.user.id),
        new ObjectId(req.params.recipeId),
        req.body.notes
      );
      if (!success) {
        return res.status(404).json({ error: 'Collection not found or unauthorized' });
      }
      res.json({ success: true });
    } catch (error) {
      logger.error('Failed to update recipe notes:', error);
      throw new DatabaseError('Failed to update recipe notes');
    }
  })
);

// Reorder recipes in a collection
router.put(
  '/:collectionId/recipes/reorder',
  auth,
  [
    param('collectionId').isString().notEmpty(),
    body('recipeOrders').isArray(),
    body('recipeOrders.*.recipeId').isString(),
    body('recipeOrders.*.order').isInt({ min: 0 }),
  ],
  validate,
  asyncHandler(async (req: AuthenticatedRequest<CollectionParams, any, ReorderRecipesBody>, res: Response) => {
    if (!req.user) {
      throw new ValidationError('Authentication required');
    }

    try {
      const success = await collectionService.reorderRecipes(
        new ObjectId(req.params.collectionId),
        new ObjectId(req.user.id),
        req.body.recipeOrders.map(order => ({
          recipeId: new ObjectId(order.recipeId),
          order: order.order,
        }))
      );
      if (!success) {
        return res.status(404).json({ error: 'Collection not found or unauthorized' });
      }
      res.json({ success: true });
    } catch (error) {
      logger.error('Failed to reorder recipes:', error);
      throw new DatabaseError('Failed to reorder recipes');
    }
  })
);

// Add a collaborator
router.post(
  '/:collectionId/collaborators',
  auth,
  [
    param('collectionId').isString().notEmpty(),
    body('userId').isString().notEmpty(),
    body('role').isIn(['editor', 'viewer']),
  ],
  validate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
      throw new ValidationError('Authentication required');
    }

    try {
      const success = await collectionService.addCollaborator(
        new ObjectId(req.params.collectionId),
        new ObjectId(req.user.id),
        new ObjectId(req.body.userId),
        req.body.role as 'editor' | 'viewer'
      );
      if (!success) {
        return res.status(404).json({ error: 'Collection not found or unauthorized' });
      }
      res.json({ success: true });
    } catch (error) {
      logger.error('Failed to add collaborator:', error);
      throw new DatabaseError('Failed to add collaborator');
    }
  })
);

// Remove a collaborator
router.delete(
  '/:collectionId/collaborators/:userId',
  auth,
  [
    param('collectionId').isString().notEmpty(),
    param('userId').isString().notEmpty(),
  ],
  validate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
      throw new ValidationError('Authentication required');
    }

    try {
      const success = await collectionService.removeCollaborator(
        new ObjectId(req.params.collectionId),
        new ObjectId(req.user.id),
        new ObjectId(req.params.userId)
      );
      if (!success) {
        return res.status(404).json({ error: 'Collection not found or unauthorized' });
      }
      res.json({ success: true });
    } catch (error) {
      logger.error('Failed to remove collaborator:', error);
      throw new DatabaseError('Failed to remove collaborator');
    }
  })
);

// Update collaborator role
router.put(
  '/:collectionId/collaborators/:userId',
  auth,
  [
    param('collectionId').isString().notEmpty(),
    param('userId').isString().notEmpty(),
    body('role').isIn(['editor', 'viewer']),
  ],
  validate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
      throw new ValidationError('Authentication required');
    }

    try {
      const success = await collectionService.updateCollaboratorRole(
        new ObjectId(req.params.collectionId),
        new ObjectId(req.user.id),
        new ObjectId(req.params.userId),
        req.body.role as 'editor' | 'viewer'
      );
      if (!success) {
        return res.status(404).json({ error: 'Collection not found or unauthorized' });
      }
      res.json({ success: true });
    } catch (error) {
      logger.error('Failed to update collaborator role:', error);
      throw new DatabaseError('Failed to update collaborator role');
    }
  })
);

// Create a share link
router.post(
  '/:collectionId/share',
  auth,
  [param('collectionId').isString().notEmpty()],
  validate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
      throw new ValidationError('Authentication required');
    }

    try {
      const shareLink = await collectionService.createShareLink(
        new ObjectId(req.params.collectionId),
        new ObjectId(req.user.id)
      );
      if (!shareLink) {
        return res.status(404).json({ error: 'Collection not found or unauthorized' });
      }
      res.json({ shareLink });
    } catch (error) {
      logger.error('Failed to create share link:', error);
      throw new DatabaseError('Failed to create share link');
    }
  })
);

// Create a collaborator invite
router.post(
  '/:collectionId/invites',
  auth,
  [
    param('collectionId').isString().notEmpty(),
    body('email').isEmail(),
    body('role').isIn(['editor', 'viewer']),
  ],
  validate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
      throw new ValidationError('Authentication required');
    }

    try {
      const invite = await collectionService.createInvite({
        collectionId: new ObjectId(req.params.collectionId),
        invitedBy: new ObjectId(req.user.id),
        email: req.body.email,
        role: req.body.role as 'editor' | 'viewer',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      });
      res.json(invite);
    } catch (error) {
      logger.error('Failed to create invite:', error);
      throw new DatabaseError('Failed to create invite');
    }
  })
);

// Accept a collaborator invite
router.post(
  '/invites/:inviteId/accept',
  auth,
  [param('inviteId').isString().notEmpty()],
  validate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
      throw new ValidationError('Authentication required');
    }

    try {
      const success = await collectionService.acceptInvite(
        new ObjectId(req.params.inviteId),
        new ObjectId(req.user.id)
      );
      if (!success) {
        return res.status(404).json({ error: 'Invite not found or expired' });
      }
      res.json({ success: true });
    } catch (error) {
      logger.error('Failed to accept invite:', error);
      throw new DatabaseError('Failed to accept invite');
    }
  })
);

// Reject a collaborator invite
router.post(
  '/invites/:inviteId/reject',
  auth,
  [param('inviteId').isString().notEmpty()],
  validate,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
      throw new ValidationError('Authentication required');
    }

    try {
      const success = await collectionService.rejectInvite(new ObjectId(req.params.inviteId));
      if (!success) {
        return res.status(404).json({ error: 'Invite not found' });
      }
      res.json({ success: true });
    } catch (error) {
      logger.error('Failed to reject invite:', error);
      throw new DatabaseError('Failed to reject invite');
    }
  })
);

// Export the underlying Express router
export default router.getRouter();

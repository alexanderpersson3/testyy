import express, { Response } from 'express';
import { check, validationResult } from 'express-validator';
import { ObjectId } from 'mongodb';

import { auth } from '../middleware/auth.js';
import { connectToDatabase } from '../db/db.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AuthenticatedRequest } from '../types/auth.js';
import { RecipeCollection } from '../types/models.js';

const router = express.Router();

// Create a new recipe collection/tab
router.post('/',
  auth,
  [
    check('name').notEmpty().trim(),
    check('description').optional().trim(),
    check('icon').optional().trim(),
    check('color').optional().trim(),
    check('isDefault').optional().isBoolean()
  ],
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const db = await connectToDatabase();
    const userId = new ObjectId(req.user!.id);

    // Get the highest order number
    const lastCollection = await db.collection<RecipeCollection>('recipe_collections')
      .findOne(
        { userId },
        { sort: { order: -1 } }
      );

    const collection: Omit<RecipeCollection, '_id'> = {
      userId,
      name: req.body.name,
      description: req.body.description,
      icon: req.body.icon,
      color: req.body.color,
      recipeIds: [],
      isDefault: req.body.isDefault || false,
      order: (lastCollection?.order ?? -1) + 1,
      collaborators: [],
      isShared: false,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // If this is marked as default, unmark other default collections
    if (collection.isDefault) {
      await db.collection<RecipeCollection>('recipe_collections').updateMany(
        { userId },
        { $set: { isDefault: false } }
      );
    }

    const result = await db.collection<RecipeCollection>('recipe_collections').insertOne(collection as RecipeCollection);

    res.status(201).json({
      success: true,
      collectionId: result.insertedId
    });
  })
);

// Get all recipe collections/tabs
router.get('/',
  auth,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const db = await connectToDatabase();
    const userId = new ObjectId(req.user!.id);

    const collections = await db.collection<RecipeCollection>('recipe_collections')
      .aggregate([
        {
          $match: {
            $or: [
              { userId },
              { 'collaborators.userId': userId }
            ]
          }
        },
        {
          $lookup: {
            from: 'recipes',
            localField: 'recipeIds',
            foreignField: '_id',
            as: 'recipes'
          }
        },
        {
          $lookup: {
            from: 'users',
            localField: 'collaborators.userId',
            foreignField: '_id',
            as: 'collaboratorDetails'
          }
        },
        {
          $project: {
            'collaboratorDetails.password': 0,
            'collaboratorDetails.email': 0
          }
        },
        {
          $sort: { order: 1 }
        }
      ])
      .toArray();

    res.json({ collections });
  })
);

// Update recipe collection/tab
router.put('/:id',
  auth,
  [
    check('name').optional().notEmpty().trim(),
    check('description').optional().trim(),
    check('icon').optional().trim(),
    check('color').optional().trim(),
    check('isDefault').optional().isBoolean(),
    check('order').optional().isInt({ min: 0 })
  ],
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const db = await connectToDatabase();
    const userId = new ObjectId(req.user!.id);
    const collectionId = new ObjectId(req.params.id);

    // Verify ownership or collaboration rights
    const collection = await db.collection<RecipeCollection>('recipe_collections').findOne({
      _id: collectionId,
      $or: [
        { userId },
        { 'collaborators.userId': userId, 'collaborators.role': 'editor' }
      ]
    });

    if (!collection) {
      return res.status(404).json({ message: 'Collection not found or unauthorized' });
    }

    const updateData: any = {
      ...req.body,
      updatedAt: new Date()
    };

    // If making this default, unmark others
    if (updateData.isDefault) {
      await db.collection<RecipeCollection>('recipe_collections').updateMany(
        { userId: collection.userId },
        { $set: { isDefault: false } }
      );
    }

    // If changing order, handle reordering
    if (typeof updateData.order === 'number' && updateData.order !== collection.order) {
      if (updateData.order > collection.order) {
        // Moving down: decrease order of items in between
        await db.collection<RecipeCollection>('recipe_collections').updateMany(
          {
            userId: collection.userId,
            order: { $gt: collection.order, $lte: updateData.order }
          },
          { $inc: { order: -1 } }
        );
      } else {
        // Moving up: increase order of items in between
        await db.collection<RecipeCollection>('recipe_collections').updateMany(
          {
            userId: collection.userId,
            order: { $gte: updateData.order, $lt: collection.order }
          },
          { $inc: { order: 1 } }
        );
      }
    }

    await db.collection<RecipeCollection>('recipe_collections').updateOne(
      { _id: collectionId },
      { $set: updateData }
    );

    res.json({ success: true });
  })
);

// Delete recipe collection/tab
router.delete('/:id',
  auth,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const db = await connectToDatabase();
    const userId = new ObjectId(req.user!.id);
    const collectionId = new ObjectId(req.params.id);

    // Verify ownership
    const collection = await db.collection<RecipeCollection>('recipe_collections').findOne({
      _id: collectionId,
      userId
    });

    if (!collection) {
      return res.status(404).json({ message: 'Collection not found or unauthorized' });
    }

    // Reorder remaining collections
    await db.collection<RecipeCollection>('recipe_collections').updateMany(
      {
        userId,
        order: { $gt: collection.order }
      },
      { $inc: { order: -1 } }
    );

    await db.collection<RecipeCollection>('recipe_collections').deleteOne({ _id: collectionId });

    res.json({ success: true });
  })
);

// Share collection with other users
router.post('/:id/share',
  auth,
  [
    check('userId').notEmpty(),
    check('role').isIn(['viewer', 'editor'])
  ],
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const db = await connectToDatabase();
    const ownerId = new ObjectId(req.user!.id);
    const collectionId = new ObjectId(req.params.id);
    const targetUserId = new ObjectId(req.body.userId);

    // Verify ownership
    const collection = await db.collection<RecipeCollection>('recipe_collections').findOne({
      _id: collectionId,
      userId: ownerId
    });

    if (!collection) {
      return res.status(404).json({ message: 'Collection not found or unauthorized' });
    }

    // Add collaborator if not already present
    const collaborator = {
      userId: targetUserId,
      role: req.body.role,
      addedAt: new Date()
    };

    await db.collection<RecipeCollection>('recipe_collections').updateOne(
      { _id: collectionId },
      {
        $pull: { collaborators: { userId: targetUserId } },
        $push: { collaborators: collaborator },
        $set: { isShared: true, updatedAt: new Date() }
      }
    );

    res.json({ success: true });
  })
);

// Remove collaborator from collection
router.delete('/:id/share/:userId',
  auth,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const db = await connectToDatabase();
    const ownerId = new ObjectId(req.user!.id);
    const collectionId = new ObjectId(req.params.id);
    const targetUserId = new ObjectId(req.params.userId);

    // Verify ownership
    const collection = await db.collection<RecipeCollection>('recipe_collections').findOne({
      _id: collectionId,
      userId: ownerId
    });

    if (!collection) {
      return res.status(404).json({ message: 'Collection not found or unauthorized' });
    }

    await db.collection<RecipeCollection>('recipe_collections').updateOne(
      { _id: collectionId },
      {
        $pull: { collaborators: { userId: targetUserId } },
        $set: { updatedAt: new Date() }
      }
    );

    // If no more collaborators, mark as not shared
    const updatedCollection = await db.collection<RecipeCollection>('recipe_collections').findOne({
      _id: collectionId
    });

    if (updatedCollection && updatedCollection.collaborators.length === 0) {
      await db.collection<RecipeCollection>('recipe_collections').updateOne(
        { _id: collectionId },
        { $set: { isShared: false } }
      );
    }

    res.json({ success: true });
  })
);

export default router; 
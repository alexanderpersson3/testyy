const express = require('express');
const router = express.Router();
const { ObjectId } = require('mongodb');
const auth = require('../middleware/auth');
const { getDb } = require('../db');

// Create custom ingredient
router.post('/', auth, async (req, res) => {
  try {
    const db = getDb();
    const { name, description, category, nutritionalInfo, customPrice, store } = req.body;

    // Validate required fields
    if (!name || !category) {
      return res.status(400).json({
        success: false,
        message: 'Name and category are required',
      });
    }

    // Check for duplicate
    const existingIngredient = await db.collection('ingredients').findOne({
      name: { $regex: new RegExp(`^${name}$`, 'i') },
    });

    if (existingIngredient) {
      return res.status(400).json({
        success: false,
        message: 'Ingredient already exists',
      });
    }

    const ingredient = {
      name,
      description,
      category,
      nutritionalInfo: nutritionalInfo || {},
      customPrice,
      store,
      userId: new ObjectId(req.user.id),
      isCustom: true,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await db.collection('ingredients').insertOne(ingredient);
    ingredient._id = result.insertedId;

    res.status(201).json({
      success: true,
      data: ingredient,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Error creating ingredient',
    });
  }
});

// Get user's custom ingredients
router.get('/my-ingredients', auth, async (req, res) => {
  try {
    const db = getDb();

    const ingredients = await db
      .collection('ingredients')
      .find({
        userId: new ObjectId(req.user.id),
        isCustom: true,
      })
      .toArray();

    res.json({
      success: true,
      data: ingredients,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Error fetching ingredients',
    });
  }
});

// Update custom ingredient
router.put('/:ingredientId', auth, async (req, res) => {
  try {
    const db = getDb();
    const { ingredientId } = req.params;
    const { name, description, category, nutritionalInfo, customPrice, store } = req.body;

    const ingredient = await db.collection('ingredients').findOne({
      _id: new ObjectId(ingredientId),
      userId: new ObjectId(req.user.id),
      isCustom: true,
    });

    if (!ingredient) {
      return res.status(404).json({
        success: false,
        message: 'Ingredient not found',
      });
    }

    const update = {
      $set: {
        name: name || ingredient.name,
        description: description || ingredient.description,
        category: category || ingredient.category,
        nutritionalInfo: nutritionalInfo || ingredient.nutritionalInfo,
        customPrice: customPrice || ingredient.customPrice,
        store: store || ingredient.store,
        updatedAt: new Date(),
      },
    };

    await db.collection('ingredients').updateOne({ _id: new ObjectId(ingredientId) }, update);

    res.json({
      success: true,
      message: 'Ingredient updated successfully',
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Error updating ingredient',
    });
  }
});

// Delete custom ingredient
router.delete('/:ingredientId', auth, async (req, res) => {
  try {
    const db = getDb();
    const { ingredientId } = req.params;

    const result = await db.collection('ingredients').deleteOne({
      _id: new ObjectId(ingredientId),
      userId: new ObjectId(req.user.id),
      isCustom: true,
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Ingredient not found',
      });
    }

    res.json({
      success: true,
      message: 'Ingredient deleted successfully',
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Error deleting ingredient',
    });
  }
});

// Get pending ingredients (for moderators)
router.get('/pending', auth, async (req, res) => {
  try {
    const db = getDb();

    // Check if user is a moderator
    const user = await db.collection('users').findOne({
      _id: new ObjectId(req.user.id),
    });

    if (!user || user.role !== 'moderator') {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized',
      });
    }

    const ingredients = await db
      .collection('ingredients')
      .find({
        isCustom: true,
        status: 'pending',
      })
      .toArray();

    res.json({
      success: true,
      data: ingredients,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Error fetching pending ingredients',
    });
  }
});

// Approve/reject ingredient (for moderators)
router.post('/:ingredientId/moderate', auth, async (req, res) => {
  try {
    const db = getDb();
    const { ingredientId } = req.params;
    const { action, reason } = req.body;

    // Check if user is a moderator
    const user = await db.collection('users').findOne({
      _id: new ObjectId(req.user.id),
    });

    if (!user || user.role !== 'moderator') {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized',
      });
    }

    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid action',
      });
    }

    const update = {
      $set: {
        status: action === 'approve' ? 'approved' : 'rejected',
        moderatedBy: new ObjectId(req.user.id),
        moderatedAt: new Date(),
        moderationReason: reason,
        updatedAt: new Date(),
      },
    };

    const result = await db
      .collection('ingredients')
      .updateOne({ _id: new ObjectId(ingredientId), isCustom: true }, update);

    if (result.matchedCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Ingredient not found',
      });
    }

    res.json({
      success: true,
      message: `Ingredient ${action}ed successfully`,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Error moderating ingredient',
    });
  }
});

module.exports = router;

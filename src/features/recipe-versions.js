const express = require('express');
const router = express.Router();
const { ObjectId } = require('mongodb');
const auth = require('../middleware/auth');
const { getDb } = require('../db');

// Save recipe as draft
router.post('/drafts', auth, async (req, res) => {
  try {
    const db = getDb();
    const { title, description, ingredients, instructions } = req.body;

    const draft = {
      title,
      description,
      ingredients,
      instructions,
      userId: new ObjectId(req.user.id),
      status: 'draft',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await db.collection('recipes').insertOne(draft);
    draft._id = result.insertedId;

    res.status(201).json({
      success: true,
      data: draft,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Error saving draft',
    });
  }
});

// Get user's drafts
router.get('/drafts', auth, async (req, res) => {
  try {
    const db = getDb();
    const drafts = await db
      .collection('recipes')
      .find({
        userId: new ObjectId(req.user.id),
        status: 'draft',
      })
      .toArray();

    res.json({
      success: true,
      data: drafts,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Error fetching drafts',
    });
  }
});

// Create recipe version (remix)
router.post('/:recipeId/versions', auth, async (req, res) => {
  try {
    const db = getDb();
    const { recipeId } = req.params;
    const { title, description, ingredients, instructions, notes } = req.body;

    // Get original recipe
    const originalRecipe = await db.collection('recipes').findOne({
      _id: new ObjectId(recipeId),
    });

    if (!originalRecipe) {
      return res.status(404).json({
        success: false,
        message: 'Recipe not found',
      });
    }

    // Create new version
    const version = {
      originalRecipeId: new ObjectId(recipeId),
      title: title || originalRecipe.title,
      description: description || originalRecipe.description,
      ingredients: ingredients || originalRecipe.ingredients,
      instructions: instructions || originalRecipe.instructions,
      notes,
      userId: new ObjectId(req.user.id),
      createdAt: new Date(),
      isVersion: true,
      versionNumber: await getNextVersionNumber(recipeId),
    };

    const result = await db.collection('recipes').insertOne(version);
    version._id = result.insertedId;

    res.status(201).json({
      success: true,
      data: version,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Error creating version',
    });
  }
});

// Get recipe versions
router.get('/:recipeId/versions', async (req, res) => {
  try {
    const db = getDb();
    const { recipeId } = req.params;

    const versions = await db
      .collection('recipes')
      .find({
        originalRecipeId: new ObjectId(recipeId),
        isVersion: true,
      })
      .sort({ versionNumber: -1 })
      .toArray();

    res.json({
      success: true,
      data: versions,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Error fetching versions',
    });
  }
});

// Helper function to get next version number
async function getNextVersionNumber(recipeId) {
  const db = getDb();
  const latestVersion = await db
    .collection('recipes')
    .findOne(
      { originalRecipeId: new ObjectId(recipeId), isVersion: true },
      { sort: { versionNumber: -1 } }
    );

  return latestVersion ? latestVersion.versionNumber + 1 : 1;
}

// Publish draft
router.post('/drafts/:draftId/publish', auth, async (req, res) => {
  try {
    const db = getDb();
    const { draftId } = req.params;

    const draft = await db.collection('recipes').findOne({
      _id: new ObjectId(draftId),
      userId: new ObjectId(req.user.id),
      status: 'draft',
    });

    if (!draft) {
      return res.status(404).json({
        success: false,
        message: 'Draft not found',
      });
    }

    const result = await db.collection('recipes').updateOne(
      { _id: new ObjectId(draftId) },
      {
        $set: {
          status: 'published',
          publishedAt: new Date(),
          updatedAt: new Date(),
        },
      }
    );

    res.json({
      success: true,
      message: 'Draft published successfully',
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Error publishing draft',
    });
  }
});

module.exports = router;

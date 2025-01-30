const express = require('express');
const { ObjectId } = require('mongodb');
const { body, validationResult } = require('express-validator');
const { recipes, ingredient, savedRecipe } = require('./collection');
const { authenticateToken } = require('./middleware/auth');

const router = express.Router();

// Validation middleware
const validateRecipe = [
  body('title').trim().notEmpty().withMessage('Title is required'),
  body('description').trim().notEmpty().withMessage('Description is required'),
  body('ingredients').isArray().withMessage('Ingredients must be an array'),
  body('ingredients.*.name').trim().notEmpty().withMessage('Ingredient name is required'),
  body('ingredients.*.amount').isNumeric().withMessage('Amount must be a number'),
  body('ingredients.*.unit').trim().notEmpty().withMessage('Unit is required'),
  body('instructions').isArray().withMessage('Instructions must be an array'),
  body('instructions.*').trim().notEmpty().withMessage('Instruction step cannot be empty'),
];

// Create recipe route
router.post('/', 
  authenticateToken,
  validateRecipe,
  (req, res, next) => {
    const errors = validationResult(req);
 
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  },
  async (req, res) => {
    try {
      const recipesCollection = await recipes();
      const recipe = {
        ...req.body,
        userId: req.userId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = await recipesCollection.insertOne(recipe);
      res.status(201).json({
        success: true,
        data: { ...recipe, _id: result.insertedId }
      });
    } catch (error) {
      console.error('Create recipe error:', error);
      res.status(500).json({ success: false, message: 'Failed to create recipe' });
    }
  }
);

// Rest of the routes...

module.exports = router;

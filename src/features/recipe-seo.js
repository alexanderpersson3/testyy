const express = require('express');
const router = express.Router();
const { validateRequest } = require('../middleware/validation');
const { authenticateToken } = require('../middleware/auth');
const { z } = require('zod');
const recipeSeoService = require('../services/recipe-seo-service');
const multer = require('multer');
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
});

// Validation schemas
const updateSeoSchema = z
  .object({
    title: z.string().min(1).optional(),
    description: z.string().optional(),
    keywords: z.array(z.string()).optional(),
    images: z
      .array(
        z.object({
          index: z.number(),
          alt_text: z.string(),
          caption: z.string().optional(),
        })
      )
      .optional(),
  })
  .strict();

const imageUploadSchema = z
  .object({
    alt_text: z.string(),
    caption: z.string().optional(),
  })
  .strict();

// Routes
router.put(
  '/:recipeId/seo',
  authenticateToken,
  validateRequest(updateSeoSchema, 'body'),
  async (req, res) => {
    try {
      const recipe = await recipeSeoService.updateRecipeSeo(req.params.recipeId, req.body);
      res.json(recipe);
    } catch (err) {
      console.error('Update recipe SEO error:', err);
      res.status(500).json({ error: 'Failed to update recipe SEO' });
    }
  }
);

router.post(
  '/:recipeId/images',
  authenticateToken,
  upload.array('images', 10),
  validateRequest(imageUploadSchema, 'body'),
  async (req, res) => {
    try {
      if (!req.files?.length) {
        return res.status(400).json({ error: 'No images uploaded' });
      }

      // Add metadata to each file
      req.files.forEach(file => {
        file.alt_text = req.body.alt_text;
        file.caption = req.body.caption;
      });

      const processedImages = await recipeSeoService.processRecipeImages(req.files);
      res.json(processedImages);
    } catch (err) {
      console.error('Process recipe images error:', err);
      res.status(500).json({ error: 'Failed to process recipe images' });
    }
  }
);

router.get('/:recipeId/meta', async (req, res) => {
  try {
    const db = getDb();
    const recipe = await db.collection('recipes').findOne({
      _id: new ObjectId(req.params.recipeId),
    });

    if (!recipe) {
      return res.status(404).json({ error: 'Recipe not found' });
    }

    const metaTags = recipeSeoService.generateMetaTags(recipe);
    const schemaMarkup = recipeSeoService.generateSchemaMarkup(recipe);
    const canonicalUrl = await recipeSeoService.getCanonicalUrl(recipe);

    res.json({
      meta_tags: metaTags,
      schema_markup: schemaMarkup,
      canonical_url: canonicalUrl,
    });
  } catch (err) {
    console.error('Get recipe meta error:', err);
    res.status(500).json({ error: 'Failed to get recipe meta information' });
  }
});

router.get('/:recipeId/schema', async (req, res) => {
  try {
    const db = getDb();
    const recipe = await db.collection('recipes').findOne({
      _id: new ObjectId(req.params.recipeId),
    });

    if (!recipe) {
      return res.status(404).json({ error: 'Recipe not found' });
    }

    const schemaMarkup = recipeSeoService.generateSchemaMarkup(recipe);
    res.json(schemaMarkup);
  } catch (err) {
    console.error('Get recipe schema error:', err);
    res.status(500).json({ error: 'Failed to get recipe schema markup' });
  }
});

router.get('/by-slug/:slug', async (req, res) => {
  try {
    const db = getDb();
    const recipe = await db.collection('recipes').findOne({
      slug: req.params.slug,
    });

    if (!recipe) {
      return res.status(404).json({ error: 'Recipe not found' });
    }

    const metaTags = recipeSeoService.generateMetaTags(recipe);
    const schemaMarkup = recipeSeoService.generateSchemaMarkup(recipe);
    const canonicalUrl = await recipeSeoService.getCanonicalUrl(recipe);

    res.json({
      recipe,
      meta_tags: metaTags,
      schema_markup: schemaMarkup,
      canonical_url: canonicalUrl,
    });
  } catch (err) {
    console.error('Get recipe by slug error:', err);
    res.status(500).json({ error: 'Failed to get recipe by slug' });
  }
});

module.exports = router;

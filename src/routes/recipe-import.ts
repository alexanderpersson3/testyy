import express, { Response } from 'express';
import { check, validationResult } from 'express-validator';
import { ObjectId } from 'mongodb';
import multer from 'multer';
import { createWorker } from 'tesseract.js';
import * as cheerio from 'cheerio';
import pdf from 'pdf-parse';
import { Router } from 'express';
import { AuthenticatedRequest } from '../types/auth';
import { auth } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';
import { Recipe, Difficulty } from '../types/recipe';
import { rateLimitMiddleware } from '../middleware/rate-limit';
import { FileRequest } from '../types/request';
import {
  ImportedRecipe,
  extractRecipeData,
  validateRecipeData
} from '../types/recipe-import';
import {
  preprocessImage,
  deskewImage,
  cropToContent
} from '../services/image-processor';
import { connectToDatabase } from '../db/connection';
import { promises as fs } from 'fs';
import path from 'path';

const router = express.Router();

// Configure multer for file uploads
const fileFilter = (
  _req: express.Request,
  file: Express.Multer.File,
  callback: (error: Error | null, acceptFile: boolean) => void
): void => {
  const allowedTypes = ['text/html', 'text/plain'];
  if (allowedTypes.includes(file.mimetype)) {
    callback(null, true);
  } else {
    callback(new Error('Invalid file type'), false);
  }
};

const upload = multer({
  dest: path.join(process.cwd(), 'uploads', 'recipes'),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
    files: 1
  },
  fileFilter
});

const importLimiter = rateLimitMiddleware.scraping();

// Import recipe from URL
router.post('/url',
  auth,
  importLimiter,
  [
    check('url').isURL()
  ],
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { url } = req.body;
    
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch URL: ${response.statusText}`);
      }
      const html = await response.text();
      const recipe = extractRecipeFromHtml(html);
      recipe.authorId = new ObjectId(req.user!.id);
      recipe.source = 'url_import';
      recipe.sourceUrl = url;

      const db = await connectToDatabase();
      const result = await db.collection<Recipe>('recipes').insertOne(recipe as Recipe);
      
      res.status(201).json({
        success: true,
        recipeId: result.insertedId
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: {
          code: 'IMPORT_ERROR',
          message: error instanceof Error ? error.message : 'Failed to import recipe'
        }
      });
    }
  })
);

// Import recipe from image
router.post('/image',
  auth,
  importLimiter,
  upload.single('image'),
  asyncHandler(async (req: AuthenticatedRequest & FileRequest, res: Response) => {
    if (!req.file) {
      return res.status(400).json({ message: 'No image file provided' });
    }

    // Preprocess the image
    const { buffer: processedBuffer } = await preprocessImage(req.file.buffer);
    
    // Deskew the image
    const deskewedBuffer = await deskewImage(processedBuffer);
    
    // Crop to content
    const croppedBuffer = await cropToContent(deskewedBuffer);

    // Initialize Tesseract worker
    const worker = await createWorker();
    await worker.loadLanguage('eng');
    await worker.initialize('eng');

    // Perform OCR on the processed image
    const { data: { text } } = await worker.recognize(croppedBuffer);
    await worker.terminate();

    // Process the extracted text
    const extractedData = extractRecipeData(text);
    const recipe = validateRecipeData(extractedData);
    recipe.authorId = new ObjectId(req.user!.id);
    recipe.source = 'image_import';

    const db = await connectToDatabase();
    const result = await db.collection<Recipe>('recipes').insertOne(recipe as unknown as Recipe);

    res.status(201).json({
      success: true,
      recipeId: result.insertedId,
      text // Include extracted text for debugging
    });
  })
);

// Import recipe from PDF
router.post('/pdf',
  auth,
  importLimiter,
  upload.single('pdf'),
  asyncHandler(async (req: AuthenticatedRequest & FileRequest, res: Response) => {
    if (!req.file) {
      return res.status(400).json({ message: 'No PDF file provided' });
    }

    // Extract text from PDF
    const data = await pdf(req.file.buffer);
    const text = data.text;

    // Process the extracted text
    const extractedData = extractRecipeData(text);
    const recipe = validateRecipeData(extractedData);
    recipe.authorId = new ObjectId(req.user!.id);
    recipe.source = 'pdf_import';

    const db = await connectToDatabase();
    const result = await db.collection<Recipe>('recipes').insertOne(recipe as unknown as Recipe);

    res.status(201).json({
      success: true,
      recipeId: result.insertedId,
      text // Include extracted text for debugging
    });
  })
);

// Import recipe from file
router.post('/file',
  auth,
  importLimiter,
  upload.single('recipe'),
  asyncHandler(async (req: FileRequest, res: Response) => {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'NO_FILE',
          message: 'No file uploaded'
        }
      });
    }

    try {
      const fileContent = await fs.readFile(req.file.path, 'utf8');
      const recipe = extractRecipeFromHtml(fileContent);
      recipe.authorId = new ObjectId(req.user!.id);
      recipe.source = 'file_import';

      const db = await connectToDatabase();
      const result = await db.collection<Recipe>('recipes').insertOne(recipe as Recipe);
      
      // Clean up the uploaded file
      await fs.unlink(req.file.path);
      
      res.status(201).json({
        success: true,
        recipeId: result.insertedId
      });
    } catch (error) {
      // Clean up the uploaded file in case of error
      if (req.file) {
        await fs.unlink(req.file.path).catch(() => {});
      }
      
      res.status(400).json({
        success: false,
        error: {
          code: 'IMPORT_ERROR',
          message: error instanceof Error ? error.message : 'Failed to import recipe'
        }
      });
    }
  })
);

// Extract recipe data from HTML
function extractRecipeFromHtml(html: string): Partial<Recipe> {
  const $ = cheerio.load(html);
  const ingredients = $('[itemProp="recipeIngredient"]').map((_, el) => $(el).text().trim()).get() ||
                     $('.ingredients li').map((_, el) => $(el).text().trim()).get();
  
  const instructions = $('[itemProp="recipeInstructions"]').map((_, el) => $(el).text().trim()).get() ||
                      $('.instructions li').map((_, el) => $(el).text().trim()).get();
  
  const now = new Date();
  
  return {
    name: $('[itemProp="name"]').first().text().trim() || $('h1').first().text().trim(),
    description: $('[itemProp="description"]').first().text().trim(),
    servings: parseInt($('[itemProp="recipeYield"]').first().text().trim()) || 1,
    prepTime: parseTimeToMinutes($('[itemProp="prepTime"]').first().text().trim()),
    cookTime: parseTimeToMinutes($('[itemProp="cookTime"]').first().text().trim()),
    ingredients: ingredients.map(text => ({
      name: text,
      amount: 1,
      unit: 'piece'
    })),
    instructions: instructions.map((text, index) => ({
      step: index + 1,
      text
    })),
    tags: [],
    categories: [],
    difficulty: 'medium' as Difficulty,
    cuisine: $('[itemProp="recipeCuisine"]').first().text().trim() || undefined,
    isPrivate: false,
    isPro: false,
    likes: 0,
    shares: 0,
    createdAt: now,
    updatedAt: now
  };
}

// Helper function to parse time strings to minutes
function parseTimeToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  
  const hours = timeStr.match(/(\d+)\s*h/i);
  const minutes = timeStr.match(/(\d+)\s*m/i);
  
  return (hours ? parseInt(hours[1]) * 60 : 0) + (minutes ? parseInt(minutes[1]) : 0);
}

export default router; 

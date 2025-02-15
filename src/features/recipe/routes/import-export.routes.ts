import { Router } from 'express';;
import type { Recipe } from '../types/express.js';
import type { Router } from '../types/express.js';;
import { ObjectId } from 'mongodb';;;;
import multer from 'multer';
import type { ExportOptions } from '../types/express.js';
import { ImportExportService } from '../services/import-export.service.js';;
import { authenticate } from '../middleware/auth.js';;
import type { validateRequest } from '../types/express.js';
import { z } from 'zod';;
import { AuthError } from '../utils/errors.js';;
import type { Request, Response } from '../types/express.js';
import type { AuthenticatedRequest } from '../types/express.js';

const router = Router();
const importExportService = ImportExportService.getInstance();

// Configure multer for file uploads
const upload = multer({
  dest: 'uploads/',
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});

// Create export job schema
const createExportSchema = z.object({
  format: z.enum(['pdf', 'json', 'csv']),
  recipeIds: z.array(z.string().regex(/^[0-9a-fA-F]{24}$/)),
  options: z
    .object({
      includeImages: z.boolean().optional(),
      includeNutrition: z.boolean().optional(),
      includeMetadata: z.boolean().optional(),
      pdfTemplate: z.enum(['simple', 'detailed', 'professional']).optional(),
    })
    .optional(),
});

// Create export job
router.post('/export', authenticate, validateRequest(createExportSchema), async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      throw new AuthError('Unauthorized');
    }

    const exportBuffer = await importExportService.exportRecipes(
      req.body.recipeIds,
      {
        format: req.body.format,
        ...req.body.options,
      }
    );
    
    res.setHeader('Content-Type', getContentType(req.body.format));
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=recipes-export.${req.body.format}`
    );
    res.send(exportBuffer);
  } catch (error) {
    res.status(500).json({ error: 'Failed to export recipes' });
  }
});

// Import recipe
router.post('/import', authenticate, upload.single('file'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      throw new AuthError('Unauthorized');
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const result = await importExportService.importRecipe(
      req.user.id,
      req.file,
      req.body.format || 'json'
    );

    if (result.success) {
      res.status(201).json({ recipeId: result.recipeId });
    } else {
      res.status(400).json({ errors: result.errors });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to import recipe' });
  }
});

function getContentType(format: string): string {
  switch (format) {
    case 'pdf':
      return 'application/pdf';
    case 'json':
      return 'application/json';
    case 'csv':
      return 'text/csv';
    default:
      return 'application/octet-stream';
  }
}

export default router;

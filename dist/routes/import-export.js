import express, { Response } from 'express';
;
import multer from 'multer';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ImportExportService } from '../services/import-export.service.js';
import { ImportFormat, ExportFormat } from '../types/import-export.js';
import { auth } from '../middleware/auth.js';
const router = express.Router();
const importExportService = ImportExportService.getInstance();
// Configure multer for file uploads
const upload = multer({
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit
        files: 1,
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = [
            'text/plain',
            'text/markdown',
            'application/json',
            'application/pdf',
            'image/jpeg',
            'image/png',
        ];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        }
        else {
            cb(new Error('Invalid file type'), false);
        }
    },
});
// Import recipes
router.post('/import', auth, upload.single('file'), [
    check('format')
        .isIn(['json', 'image'])
        .withMessage('Invalid import format'),
    check('options.skipDuplicates').optional().isBoolean(),
    check('options.mergeExisting').optional().isBoolean(),
    check('options.importImages').optional().isBoolean(),
    check('options.detectLanguage').optional().isBoolean(),
    check('options.parseIngredients').optional().isBoolean(),
    check('options.parseInstructions').optional().isBoolean(),
], asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    if (!req.file) {
        return res.status(400).json({
            error: 'No file provided.',
        });
    }
    const format = req.body.format;
    const userId = req.user.id;
    const result = await importExportService.importRecipe(userId, req.file, format);
    res.json(result);
}));
// Export recipes
router.post('/export', auth, [
    check('format')
        .isIn(['json', 'pdf', 'csv'])
        .withMessage('Invalid export format'),
    check('recipeIds').isArray().withMessage('Recipe IDs must be an array'),
    check('recipeIds.*').isMongoId().withMessage('Invalid recipe ID'),
    check('options.includeImages').optional().isBoolean(),
    check('options.includeNutrition').optional().isBoolean(),
    check('options.includeTags').optional().isBoolean(),
    check('options.includeComments').optional().isBoolean(),
    check('options.includeRatings').optional().isBoolean(),
    check('options.includeMetadata').optional().isBoolean(),
], asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    const format = req.body.format;
    const { recipeIds, options } = req.body;
    try {
        const result = await importExportService.exportRecipes(recipeIds, {
            format,
            includeImages: options?.includeImages,
            includeNutrition: options?.includeNutrition,
            includeMetadata: options?.includeMetadata,
            pdfTemplate: options?.pdfTemplate,
        });
        // Set appropriate headers based on format
        switch (format) {
            case 'json':
                res.setHeader('Content-Type', 'application/json');
                res.setHeader('Content-Disposition', 'attachment; filename=recipes.json');
                break;
            case 'pdf':
                res.setHeader('Content-Type', 'application/pdf');
                res.setHeader('Content-Disposition', 'attachment; filename=recipes.pdf');
                break;
            case 'csv':
                res.setHeader('Content-Type', 'text/csv');
                res.setHeader('Content-Disposition', 'attachment; filename=recipes.csv');
                break;
        }
        res.send(result);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
}));
// Get supported formats
router.get('/formats', asyncHandler(async (req, res) => {
    res.json({
        import: ['json', 'image'],
        export: ['json', 'pdf', 'csv'],
    });
}));
// Validate import data
router.post('/validate', auth, upload.single('file'), [
    check('format')
        .isIn(['json', 'image'])
        .withMessage('Invalid import format'),
], asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    if (!req.file) {
        return res.status(400).json({
            error: 'No file provided.',
        });
    }
    const format = req.body.format;
    const userId = req.user.id;
    // Try to import without saving
    const result = await importExportService.importRecipe(userId, req.file, format);
    res.json({
        valid: result.success,
        errors: result.errors,
    });
}));
export default router;
//# sourceMappingURL=import-export.js.map
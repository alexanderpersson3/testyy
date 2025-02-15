import express, { Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/require-auth.js';
import { TranslationService } from '../services/translation.service.js';
import { asyncHandler } from '../utils/async-handler.js';
import { LanguageCode, SUPPORTED_LANGUAGES } from '../types/language.js';
const router = express.Router();
const translationService = TranslationService.getInstance();
// Validation schemas
const translationSchema = z
    .object({
    title: z.string(),
    description: z.string(),
    ingredients: z.array(z.object({
        name: z.string(),
        notes: z.string().optional(),
    })),
    instructions: z.array(z.object({
        text: z.string(),
    })),
    creatorTips: z
        .array(z.object({
        text: z.string(),
    }))
        .optional(),
    languageCode: z.enum(['sv', 'no', 'dk', 'fi', 'en', 'de', 'fr', 'it', 'es']),
})
    .strict();
// Get recipe translation
router.get('/recipes/:recipeId/translations/:languageCode', asyncHandler(async (req, res) => {
    const { recipeId, languageCode } = req.params;
    if (!SUPPORTED_LANGUAGES.includes(languageCode)) {
        return res.status(400).json({
            success: false,
            message: 'Language not supported',
        });
    }
    const translation = await translationService.getTranslation(recipeId, languageCode);
    if (!translation) {
        return res.status(404).json({
            success: false,
            message: 'Translation not found',
        });
    }
    res.json({
        success: true,
        translation,
    });
}));
// Add or update translation
router.put('/recipes/:recipeId/translations', requireAuth, validateRequest(z
    .object({
    language: z.string(),
    translations: z.record(z.string(), z.string()),
})
    .strict()), asyncHandler(async (req, res) => {
    const { recipeId } = req.params;
    const userId = req.user.id;
    await translationService.addTranslation(recipeId, {
        title: req.body.translations.title,
        description: req.body.translations.description,
        ingredients: req.body.translations.ingredients,
        instructions: req.body.translations.instructions,
        languageCode: req.body.language
    }, userId, false // manual translation
    );
    res.json({
        success: true,
    });
}));
// Request translation
router.post('/recipes/:recipeId/translations/request', requireAuth, validateRequest(z
    .object({
    languageCode: z.enum(['sv', 'no', 'dk', 'fi', 'en', 'de', 'fr', 'it', 'es']),
})
    .strict()), asyncHandler(async (req, res) => {
    const { recipeId } = req.params;
    const { languageCode } = req.body;
    const userId = req.user.id;
    const requestId = await translationService.requestTranslation(recipeId, userId, languageCode);
    res.status(201).json({
        success: true,
        requestId,
    });
}));
// Get all translations for a recipe
router.get('/recipes/:recipeId/translations', asyncHandler(async (req, res) => {
    const { recipeId } = req.params;
    const translations = await translationService.getAllTranslations(recipeId);
    res.json({
        success: true,
        translations,
    });
}));
// Verify translation
router.post('/recipes/:recipeId/translations/:languageCode/verify', requireAuth, asyncHandler(async (req, res) => {
    const { recipeId, languageCode } = req.params;
    const userId = req.user.id;
    if (!SUPPORTED_LANGUAGES.includes(languageCode)) {
        return res.status(400).json({
            success: false,
            message: 'Language not supported',
        });
    }
    await translationService.verifyTranslation(recipeId, languageCode, userId);
    res.json({
        success: true,
    });
}));
// Delete translation
router.delete('/recipes/:recipeId/translations/:languageCode', requireAuth, asyncHandler(async (req, res) => {
    const { recipeId, languageCode } = req.params;
    if (!SUPPORTED_LANGUAGES.includes(languageCode)) {
        return res.status(400).json({
            success: false,
            message: 'Language not supported',
        });
    }
    await translationService.deleteTranslation(recipeId, languageCode);
    res.json({
        success: true,
    });
}));
export default router;
//# sourceMappingURL=translations.js.map
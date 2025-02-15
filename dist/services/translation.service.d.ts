import { ObjectId } from 'mongodb';
import type { RecipeDocument } from '../types/index.js';
import { Translation, LanguageCode, TranslationInput } from '../types/language.js';
export declare class TranslationService {
    private static instance;
    private constructor();
    static getInstance(): TranslationService;
    /**
     * Add a translation for a recipe
     */
    addTranslation(recipeId: string, translation: TranslationInput, userId: string, isAutomatic?: boolean): Promise<ObjectId>;
    /**
     * Update an existing translation
     */
    updateTranslation(recipeId: string, languageCode: LanguageCode, translation: Partial<TranslationInput>, userId: string): Promise<boolean>;
    /**
     * Get a translation
     */
    getTranslation(recipeId: string, languageCode: LanguageCode): Promise<Translation | null>;
    /**
     * Get all translations for a recipe
     */
    getAllTranslations(recipeId: string): Promise<Translation[]>;
    /**
     * Delete a translation
     */
    deleteTranslation(recipeId: string, languageCode: LanguageCode): Promise<boolean>;
    /**
     * Get a recipe in the requested language
     */
    getRecipeInLanguage(recipeId: string, langCode: LanguageCode): Promise<RecipeDocument & {
        translation?: Translation;
    }>;
    /**
     * Check if a language is supported
     */
    isLanguageSupported(langCode: string): langCode is LanguageCode;
    /**
     * Request a translation for a recipe
     */
    requestTranslation(recipeId: string, userId: string, languageCode: LanguageCode): Promise<ObjectId>;
    /**
     * Verify a translation
     */
    verifyTranslation(recipeId: string, languageCode: LanguageCode, verifierId: string): Promise<void>;
}

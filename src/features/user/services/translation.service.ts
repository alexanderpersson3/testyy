import type { Recipe } from '../types/express.js';
import { ObjectId } from 'mongodb';;;;
import { connectToDatabase } from '../db.js';;
import type { RecipeTranslation, RecipeDocument } from '../types/express.js';
import type { TranslationRequest } from '../types/express.js';
import { Translation, LanguageCode, TranslationInput, DEFAULT_LANGUAGE, SUPPORTED_LANGUAGES, TranslationMetadata,  } from '../types/language.js';;
import logger from '../utils/logger.js';

export class TranslationService {
  private static instance: TranslationService;

  private constructor() {}

  static getInstance(): TranslationService {
    if (!TranslationService.instance) {
      TranslationService.instance = new TranslationService();
    }
    return TranslationService.instance;
  }

  /**
   * Add a translation for a recipe
   */
  async addTranslation(
    recipeId: string,
    translation: TranslationInput,
    userId: string,
    isAutomatic: boolean = false
  ): Promise<ObjectId> {
    const db = await connectToDatabase();

    // Create translation metadata
    const metadata: TranslationMetadata = {
      translatedBy: new ObjectId(userId),
      translatedAt: new Date(),
      lastUpdated: new Date(),
      status: 'pending',
      confidence: isAutomatic ? 0.7 : 1.0,
      isAutomatic,
    };

    // Create translation document
    const translationDoc: Translation = {
      recipeId: new ObjectId(recipeId),
      languageCode: translation.languageCode,
      title: translation.title,
      description: translation.description,
      ingredients: translation.ingredients,
      instructions: translation.instructions,
      metadata,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Insert translation
    const result = await db
      .collection<Translation>('recipe_translations')
      .insertOne(translationDoc);

    // Update recipe's available languages
    await db.collection('recipes').updateOne(
      { _id: new ObjectId(recipeId) },
      {
        $addToSet: { availableLanguages: translation.languageCode },
        $set: { updatedAt: new Date() },
      }
    );

    return result.insertedId;
  }

  /**
   * Update an existing translation
   */
  async updateTranslation(
    recipeId: string,
    languageCode: LanguageCode,
    translation: Partial<TranslationInput>,
    userId: string
  ): Promise<boolean> {
    const db = await connectToDatabase();

    // Verify translation exists
    const existingTranslation = await db.collection<Translation>('recipe_translations').findOne({
      recipeId: new ObjectId(recipeId),
      languageCode,
    });

    if (!existingTranslation) {
      throw new Error('Translation not found');
    }

    // Update translation
    const updateData: Partial<Translation> = {
      ...translation,
      metadata: {
        ...existingTranslation.metadata,
        lastUpdated: new Date(),
        translatedBy: new ObjectId(userId),
        isAutomatic: false,
      },
      updatedAt: new Date(),
    };

    const result = await db.collection<Translation>('recipe_translations').updateOne(
      {
        recipeId: new ObjectId(recipeId),
        languageCode,
      },
      { $set: updateData }
    );

    return result.modifiedCount > 0;
  }

  /**
   * Get a translation
   */
  async getTranslation(recipeId: string, languageCode: LanguageCode): Promise<Translation | null> {
    const db = await connectToDatabase();

    return await db.collection<Translation>('recipe_translations').findOne({
      recipeId: new ObjectId(recipeId),
      languageCode,
    });
  }

  /**
   * Get all translations for a recipe
   */
  async getAllTranslations(recipeId: string): Promise<Translation[]> {
    const db = await connectToDatabase();

    return await db
      .collection<Translation>('recipe_translations')
      .find({
        recipeId: new ObjectId(recipeId),
      })
      .toArray();
  }

  /**
   * Delete a translation
   */
  async deleteTranslation(recipeId: string, languageCode: LanguageCode): Promise<boolean> {
    const db = await connectToDatabase();

    // Delete translation
    const result = await db.collection<Translation>('recipe_translations').deleteOne({
      recipeId: new ObjectId(recipeId),
      languageCode,
    });

    if (result.deletedCount > 0) {
      // Update recipe's available languages
      await db.collection('recipes').updateOne(
        { _id: new ObjectId(recipeId) },
        {
          $pull: { availableLanguages: languageCode },
          $set: { updatedAt: new Date() },
        }
      );
      return true;
    }

    return false;
  }

  /**
   * Get a recipe in the requested language
   */
  async getRecipeInLanguage(
    recipeId: string,
    langCode: LanguageCode
  ): Promise<RecipeDocument & { translation?: Translation }> {
    const db = await connectToDatabase();
    const recipe = await db.collection<RecipeDocument>('recipes').findOne({
      _id: new ObjectId(recipeId),
    });

    if (!recipe) {
      throw new Error('Recipe not found');
    }

    // If requested language is the same as recipe's language, return recipe as is
    if (langCode === recipe.language) {
      return recipe;
    }

    // If requested language is not in available languages, throw error
    if (!recipe.availableLanguages?.includes(langCode)) {
      throw new Error(`Translation not available for language: ${langCode}`);
    }

    // Get translation if available
    const translation = await this.getTranslation(recipeId, langCode);
    if (!translation) {
      throw new Error(`Translation not found for language: ${langCode}`);
    }

    return { ...recipe, translation };
  }

  /**
   * Check if a language is supported
   */
  isLanguageSupported(langCode: string): langCode is LanguageCode {
    return SUPPORTED_LANGUAGES.includes(langCode as LanguageCode);
  }

  /**
   * Request a translation for a recipe
   */
  async requestTranslation(
    recipeId: string,
    userId: string,
    languageCode: LanguageCode
  ): Promise<ObjectId> {
    const db = await connectToDatabase();

    // Verify recipe exists and language is supported
    const recipe = await db.collection('recipes').findOne({
      _id: new ObjectId(recipeId),
    });

    if (!recipe) {
      throw new Error('Recipe not found');
    }

    if (!SUPPORTED_LANGUAGES.includes(languageCode)) {
      throw new Error('Language not supported');
    }

    // Check if translation already exists
    if (recipe.availableLanguages?.includes(languageCode)) {
      throw new Error(`Translation for language ${languageCode} already exists`);
    }

    // Create translation request
    const request: Omit<TranslationRequest, '_id'> = {
      recipeId: new ObjectId(recipeId),
      languageCode,
      requestedBy: new ObjectId(userId),
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await db
      .collection<TranslationRequest>('translation_requests')
      .insertOne(request);
    return result.insertedId;
  }

  /**
   * Verify a translation
   */
  async verifyTranslation(
    recipeId: string,
    languageCode: LanguageCode,
    verifierId: string
  ): Promise<void> {
    const db = await connectToDatabase();

    const result = await db.collection<Translation>('recipe_translations').updateOne(
      {
        recipeId: new ObjectId(recipeId),
        languageCode,
      },
      {
        $set: {
          'metadata.status': 'approved',
          'metadata.reviewedBy': new ObjectId(verifierId),
          'metadata.reviewedAt': new Date(),
          'metadata.lastUpdated': new Date(),
          updatedAt: new Date(),
        },
      }
    );

    if (!result.matchedCount) {
      throw new Error('Translation not found');
    }
  }
}

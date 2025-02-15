import { promises as fs } from 'fs';;
;
;
import type { Collection } from 'mongodb';
import type { ObjectId } from '../types/express.js';
import { Db } from 'mongodb';;
import { connectToDatabase } from '../db.js';;
import logger from '../utils/logger.js';
import { StorageService } from '../storage.service.js';;
import type { RecipeService } from '../types/express.js';
import type { Recipe } from '../types/express.js';
import type { CollectionService } from '../types/express.js';
import { NotificationManagerService } from '../notification-manager.service.js';;
import type { ExportOptions } from '../types/express.js';
import { ExportJob, ExportFormat, ExportTemplate, ExportResult, ExportNotification,  } from '../types/export.js';;
import { generatePDF } from '../utils/pdf-generator.js';;
import type { formatRecipeForExport } from '../types/express.js';
import { NotificationChannel } from '../types.js';;
import { createObjectCsvWriter } from 'csv-writer';;
import { DatabaseError, ValidationError, NotFoundError } from '../utils/errors.js';;

interface ExportJobDocument extends Omit<ExportJob, '_id'> {
  _id?: ObjectId;
}

export interface ExportServiceInterface {
  createExportJob(
    userId: ObjectId,
    format: ExportFormat,
    options: ExportOptions,
    recipeIds: ObjectId[],
    collectionIds?: ObjectId[]
  ): Promise<ExportJob>;

  getExportJob(jobId: ObjectId): Promise<ExportJob | null>;

  saveTemplate(
    userId: ObjectId,
    template: Omit<ExportTemplate, '_id' | 'createdAt' | 'updatedAt'>
  ): Promise<ExportTemplate>;

  getTemplate(templateId: ObjectId): Promise<ExportTemplate | null>;

  getTemplates(userId: ObjectId): Promise<ExportTemplate[]>;

  deleteTemplate(templateId: ObjectId, userId: ObjectId): Promise<boolean>;
}

export class ExportService implements ExportServiceInterface {
  private static instance: ExportService;
  private initialized: boolean = false;
  private db!: Db;
  private exportJobsCollection!: Collection<ExportJobDocument>;
  private exportTemplatesCollection!: Collection<ExportTemplate>;
  private readonly storageService: StorageService;
  private readonly recipeService: RecipeService;
  private readonly collectionService: CollectionService;
  private readonly notificationService: NotificationManagerService;

  private constructor() {
    this.storageService = StorageService.getInstance();
    this.recipeService = RecipeService.getInstance();
    this.collectionService = new CollectionService();
    this.notificationService = NotificationManagerService.getInstance();
    this.initialize().catch(error => {
      logger.error('Failed to initialize ExportService:', error);
    });
  }

  private async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      this.db = await connectToDatabase();
      this.exportJobsCollection = this.db.collection<ExportJobDocument>('export_jobs');
      this.exportTemplatesCollection = this.db.collection<ExportTemplate>('export_templates');

      // Create indexes
      await Promise.all([
        this.exportJobsCollection.createIndex({ userId: 1 }),
        this.exportJobsCollection.createIndex({ status: 1 }),
        this.exportJobsCollection.createIndex({ createdAt: 1 }),
        this.exportTemplatesCollection.createIndex({ userId: 1 }),
      ]);

      this.initialized = true;
      logger.info('ExportService initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize ExportService:', error);
      throw new DatabaseError('Failed to initialize ExportService');
    }
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  public static getInstance(): ExportService {
    if (!ExportService.instance) {
      ExportService.instance = new ExportService();
    }
    return ExportService.instance;
  }

  private validateExportOptions(options: ExportOptions): void {
    if (options.pageSize && !['A4', 'Letter'].includes(options.pageSize)) {
      throw new ValidationError('Invalid page size');
    }
    if (options.orientation && !['portrait', 'landscape'].includes(options.orientation)) {
      throw new ValidationError('Invalid orientation');
    }
  }

  public async createExportJob(
    userId: ObjectId,
    format: ExportFormat,
    options: ExportOptions,
    recipeIds: ObjectId[],
    collectionIds?: ObjectId[]
  ): Promise<ExportJob> {
    await this.ensureInitialized();
    this.validateExportOptions(options);

    try {
      const now = new Date();
      const job: ExportJobDocument = {
        userId,
        status: 'pending',
        format,
        options,
        recipeIds,
        collectionIds,
        progress: 0,
        createdAt: now,
        updatedAt: now,
      };

      const result = await this.exportJobsCollection.insertOne(job);
      const newJob = {
        ...job,
        _id: result.insertedId,
      } as ExportJob;

      // Start processing in background
      this.processExportJob(newJob).catch(error => {
        logger.error('Failed to process export job:', error);
      });

      return newJob;
    } catch (error) {
      logger.error('Failed to create export job:', error);
      throw new DatabaseError('Failed to create export job');
    }
  }

  public async getExportJob(jobId: ObjectId): Promise<ExportJob | null> {
    await this.ensureInitialized();

    try {
      const job = await this.exportJobsCollection.findOne({ _id: jobId });
      return job as ExportJob | null;
    } catch (error) {
      logger.error('Failed to get export job:', error);
      throw new DatabaseError('Failed to get export job');
    }
  }

  private async processExportJob(job: ExportJob): Promise<void> {
    await this.ensureInitialized();

    try {
      // Update status to processing
      await this.exportJobsCollection.updateOne(
        { _id: job._id },
        {
          $set: {
            status: 'processing',
            startedAt: new Date(),
            updatedAt: new Date(),
          },
        }
      );

      // Get recipes
      const recipes = await this.getRecipesForExport(job);

      // Generate export file
      const result = await this.generateExport(recipes, job.format, job.options);

      // Update job with result
      await this.exportJobsCollection.updateOne(
        { _id: job._id },
        {
          $set: {
            status: 'completed',
            resultUrl: result.url,
            progress: 100,
            completedAt: new Date(),
            updatedAt: new Date(),
          },
        }
      );

      // Send notification
      const notification: ExportNotification = {
        userId: job.userId,
        type: 'export_completed',
        title: 'Export Completed',
        message: `Your ${job.format.toUpperCase()} export is ready`,
        data: { jobId: job._id },
        channels: [NotificationChannel.IN_APP],
      };
      await this.notificationService.sendNotification(notification);
    } catch (error) {
      logger.error('Export job failed:', error);

      // Update job with error
      await this.exportJobsCollection.updateOne(
        { _id: job._id },
        {
          $set: {
            status: 'failed',
            error: error instanceof Error ? error.message : 'Unknown error',
            updatedAt: new Date(),
          },
        }
      );

      // Send notification
      const notification: ExportNotification = {
        userId: job.userId,
        type: 'export_failed',
        title: 'Export Failed',
        message: 'There was an error exporting your recipes',
        data: { jobId: job._id },
        channels: [NotificationChannel.IN_APP],
      };
      await this.notificationService.sendNotification(notification);
    }
  }

  private async getRecipesForExport(job: ExportJob): Promise<Recipe[]> {
    const recipes: Recipe[] = [];

    try {
      // Get recipes by ID
      if (job.recipeIds?.length) {
        const recipesByIds = await this.recipeService.getRecipes(job.recipeIds);
        recipes.push(...recipesByIds);
      }

      // Get recipes from collections
      if (job.collectionIds?.length) {
        for (const collectionId of job.collectionIds) {
          const collection = await this.collectionService.getCollection(collectionId, job.userId);
          if (collection?.recipes?.length) {
            const validRecipeIds = collection.recipes
              .filter(r => r.recipeId instanceof ObjectId)
              .map(r => r.recipeId);

            if (validRecipeIds.length > 0) {
              const collectionRecipes = await this.recipeService.getRecipes(validRecipeIds);
              recipes.push(...collectionRecipes);
            }
          }
        }
      }

      // Remove duplicates by ID
      const uniqueRecipes = recipes.reduce<Recipe[]>((acc: any, recipe: any) => {
        if (recipe._id && !acc.some(r => r._id?.equals(recipe._id))) {
          acc.push(recipe);
        }
        return acc;
      }, []);

      return uniqueRecipes;
    } catch (error) {
      logger.error('Failed to get recipes for export:', error);
      throw new DatabaseError('Failed to get recipes for export');
    }
  }

  private async generateExport(
    recipes: Recipe[],
    format: ExportFormat,
    options: ExportOptions
  ): Promise<ExportResult> {
    try {
      const formattedRecipes = recipes.map(recipe => formatRecipeForExport(recipe, options));

      switch (format) {
        case 'pdf':
          return this.generatePdfExport(formattedRecipes, options);
        case 'json':
          return this.generateJsonExport(formattedRecipes);
        case 'csv':
          return this.generateCsvExport(formattedRecipes);
        default:
          throw new ValidationError(`Unsupported export format: ${format}`);
      }
    } catch (error) {
      logger.error('Failed to generate export:', error);
      throw new DatabaseError('Failed to generate export');
    }
  }

  private async generatePdfExport(
    recipes: ReturnType<typeof formatRecipeForExport>[],
    options: ExportOptions
  ): Promise<ExportResult> {
    try {
      const pdfBuffer = await generatePDF(recipes as unknown as Recipe[]);
      const filename = `recipes_${Date.now()}.pdf`;
      const url = await this.storageService.uploadFile(filename, pdfBuffer, {
        contentType: 'application/pdf',
        metadata: {
          pageCount: recipes.length.toString(),
          template: options.pdfTemplate || 'default',
        },
      });

      return {
        url,
        format: 'pdf',
        size: pdfBuffer.length,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        metadata: {
          pageCount: recipes.length,
          template: options.pdfTemplate || 'default',
        },
      };
    } catch (error) {
      logger.error('Failed to generate PDF export:', error);
      throw new DatabaseError('Failed to generate PDF export');
    }
  }

  private async generateJsonExport(
    recipes: ReturnType<typeof formatRecipeForExport>[]
  ): Promise<ExportResult> {
    try {
      const jsonContent = JSON.stringify(recipes, null, 2);
      const buffer = Buffer.from(jsonContent, 'utf-8');
      const filename = `recipes_${Date.now()}.json`;
      const url = await this.storageService.uploadFile(filename, buffer, {
        contentType: 'application/json',
        metadata: {
          recipeCount: recipes.length.toString(),
        },
      });

      return {
        url,
        format: 'json',
        size: buffer.length,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        metadata: {
          pageCount: recipes.length,
        },
      };
    } catch (error) {
      logger.error('Failed to generate JSON export:', error);
      throw new DatabaseError('Failed to generate JSON export');
    }
  }

  private async generateCsvExport(
    recipes: ReturnType<typeof formatRecipeForExport>[]
  ): Promise<ExportResult> {
    try {
      const csvWriter = createObjectCsvWriter({
        path: 'temp.csv',
        header: [
          { id: 'title', title: 'Title' },
          { id: 'description', title: 'Description' },
          { id: 'servings', title: 'Servings' },
          { id: 'prepTime', title: 'Prep Time (min)' },
          { id: 'cookTime', title: 'Cook Time (min)' },
          { id: 'totalTime', title: 'Total Time (min)' },
          { id: 'difficulty', title: 'Difficulty' },
          { id: 'cuisine', title: 'Cuisine' },
          { id: 'ingredients', title: 'Ingredients' },
          { id: 'instructions', title: 'Instructions' },
        ],
      });

      await csvWriter.writeRecords(
        recipes.map(recipe => ({
          ...recipe,
          ingredients: recipe.ingredients.map(i => `${i.amount} ${i.unit} ${i.name}`).join('; '),
          instructions: recipe.instructions.map(i => i.text).join('; '),
        }))
      );

      const csvContent = await fs.readFile('temp.csv');
      await fs.unlink('temp.csv');

      const filename = `recipes_${Date.now()}.csv`;
      const url = await this.storageService.uploadFile(filename, csvContent, {
        contentType: 'text/csv',
        metadata: {
          recipeCount: recipes.length.toString(),
        },
      });

      return {
        url,
        format: 'csv',
        size: csvContent.length,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        metadata: {
          pageCount: recipes.length,
        },
      };
    } catch (error) {
      logger.error('Failed to generate CSV export:', error);
      throw new DatabaseError('Failed to generate CSV export');
    }
  }

  public async saveTemplate(
    userId: ObjectId,
    template: Omit<ExportTemplate, '_id' | 'createdAt' | 'updatedAt'>
  ): Promise<ExportTemplate> {
    await this.ensureInitialized();

    try {
      const now = new Date();
      const newTemplate: ExportTemplate = {
        _id: new ObjectId(),
        ...template,
        userId,
        createdAt: now,
        updatedAt: now,
      };

      await this.exportTemplatesCollection.insertOne(newTemplate);
      return newTemplate;
    } catch (error) {
      logger.error('Failed to save export template:', error);
      throw new DatabaseError('Failed to save export template');
    }
  }

  public async getTemplate(templateId: ObjectId): Promise<ExportTemplate | null> {
    await this.ensureInitialized();

    try {
      return this.exportTemplatesCollection.findOne({ _id: templateId });
    } catch (error) {
      logger.error('Failed to get export template:', error);
      throw new DatabaseError('Failed to get export template');
    }
  }

  public async getTemplates(userId: ObjectId): Promise<ExportTemplate[]> {
    await this.ensureInitialized();

    try {
      return this.exportTemplatesCollection
        .find({
          $or: [{ userId }, { isPublic: true }],
        })
        .toArray();
    } catch (error) {
      logger.error('Failed to get export templates:', error);
      throw new DatabaseError('Failed to get export templates');
    }
  }

  public async deleteTemplate(templateId: ObjectId, userId: ObjectId): Promise<boolean> {
    await this.ensureInitialized();

    try {
      const result = await this.exportTemplatesCollection.deleteOne({
        _id: templateId,
        userId,
        isDefault: { $ne: true },
      });

      return result.deletedCount > 0;
    } catch (error) {
      logger.error('Failed to delete export template:', error);
      throw new DatabaseError('Failed to delete export template');
    }
  }
}

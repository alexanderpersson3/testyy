import * as fs from 'fs';
import { Db } from 'mongodb';
import { connectToDatabase } from '../db.js';
import logger from '../utils/logger.js';
import { StorageService } from '../storage.service.js';
import { NotificationManagerService } from '../notification-manager.service.js';
import { ExportJob, ExportFormat, ExportTemplate, ExportResult, ExportNotification, } from '../types/export.js';
import { generatePDF } from '../utils/pdf-generator.js';
import { NotificationChannel } from '../types.js';
import { createObjectCsvWriter } from 'csv-writer';
import { DatabaseError, ValidationError, NotFoundError } from '../utils/errors.js';
export class ExportService {
    constructor() {
        this.initialized = false;
        this.storageService = StorageService.getInstance();
        this.recipeService = RecipeService.getInstance();
        this.collectionService = new CollectionService();
        this.notificationService = NotificationManagerService.getInstance();
        this.initialize().catch(error => {
            logger.error('Failed to initialize ExportService:', error);
        });
    }
    async initialize() {
        if (this.initialized)
            return;
        try {
            this.db = await connectToDatabase();
            this.exportJobsCollection = this.db.collection('export_jobs');
            this.exportTemplatesCollection = this.db.collection('export_templates');
            // Create indexes
            await Promise.all([
                this.exportJobsCollection.createIndex({ userId: 1 }),
                this.exportJobsCollection.createIndex({ status: 1 }),
                this.exportJobsCollection.createIndex({ createdAt: 1 }),
                this.exportTemplatesCollection.createIndex({ userId: 1 }),
            ]);
            this.initialized = true;
            logger.info('ExportService initialized successfully');
        }
        catch (error) {
            logger.error('Failed to initialize ExportService:', error);
            throw new DatabaseError('Failed to initialize ExportService');
        }
    }
    async ensureInitialized() {
        if (!this.initialized) {
            await this.initialize();
        }
    }
    static getInstance() {
        if (!ExportService.instance) {
            ExportService.instance = new ExportService();
        }
        return ExportService.instance;
    }
    validateExportOptions(options) {
        if (options.pageSize && !['A4', 'Letter'].includes(options.pageSize)) {
            throw new ValidationError('Invalid page size');
        }
        if (options.orientation && !['portrait', 'landscape'].includes(options.orientation)) {
            throw new ValidationError('Invalid orientation');
        }
    }
    async createExportJob(userId, format, options, recipeIds, collectionIds) {
        await this.ensureInitialized();
        this.validateExportOptions(options);
        try {
            const now = new Date();
            const job = {
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
            };
            // Start processing in background
            this.processExportJob(newJob).catch(error => {
                logger.error('Failed to process export job:', error);
            });
            return newJob;
        }
        catch (error) {
            logger.error('Failed to create export job:', error);
            throw new DatabaseError('Failed to create export job');
        }
    }
    async getExportJob(jobId) {
        await this.ensureInitialized();
        try {
            const job = await this.exportJobsCollection.findOne({ _id: jobId });
            return job;
        }
        catch (error) {
            logger.error('Failed to get export job:', error);
            throw new DatabaseError('Failed to get export job');
        }
    }
    async processExportJob(job) {
        await this.ensureInitialized();
        try {
            // Update status to processing
            await this.exportJobsCollection.updateOne({ _id: job._id }, {
                $set: {
                    status: 'processing',
                    startedAt: new Date(),
                    updatedAt: new Date(),
                },
            });
            // Get recipes
            const recipes = await this.getRecipesForExport(job);
            // Generate export file
            const result = await this.generateExport(recipes, job.format, job.options);
            // Update job with result
            await this.exportJobsCollection.updateOne({ _id: job._id }, {
                $set: {
                    status: 'completed',
                    resultUrl: result.url,
                    progress: 100,
                    completedAt: new Date(),
                    updatedAt: new Date(),
                },
            });
            // Send notification
            const notification = {
                userId: job.userId,
                type: 'export_completed',
                title: 'Export Completed',
                message: `Your ${job.format.toUpperCase()} export is ready`,
                data: { jobId: job._id },
                channels: [NotificationChannel.IN_APP],
            };
            await this.notificationService.sendNotification(notification);
        }
        catch (error) {
            logger.error('Export job failed:', error);
            // Update job with error
            await this.exportJobsCollection.updateOne({ _id: job._id }, {
                $set: {
                    status: 'failed',
                    error: error instanceof Error ? error.message : 'Unknown error',
                    updatedAt: new Date(),
                },
            });
            // Send notification
            const notification = {
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
    async getRecipesForExport(job) {
        const recipes = [];
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
            const uniqueRecipes = recipes.reduce((acc, recipe) => {
                if (recipe._id && !acc.some(r => r._id?.equals(recipe._id))) {
                    acc.push(recipe);
                }
                return acc;
            }, []);
            return uniqueRecipes;
        }
        catch (error) {
            logger.error('Failed to get recipes for export:', error);
            throw new DatabaseError('Failed to get recipes for export');
        }
    }
    async generateExport(recipes, format, options) {
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
        }
        catch (error) {
            logger.error('Failed to generate export:', error);
            throw new DatabaseError('Failed to generate export');
        }
    }
    async generatePdfExport(recipes, options) {
        try {
            const pdfBuffer = await generatePDF(recipes);
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
        }
        catch (error) {
            logger.error('Failed to generate PDF export:', error);
            throw new DatabaseError('Failed to generate PDF export');
        }
    }
    async generateJsonExport(recipes) {
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
        }
        catch (error) {
            logger.error('Failed to generate JSON export:', error);
            throw new DatabaseError('Failed to generate JSON export');
        }
    }
    async generateCsvExport(recipes) {
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
            await csvWriter.writeRecords(recipes.map(recipe => ({
                ...recipe,
                ingredients: recipe.ingredients.map(i => `${i.amount} ${i.unit} ${i.name}`).join('; '),
                instructions: recipe.instructions.map(i => i.text).join('; '),
            })));
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
        }
        catch (error) {
            logger.error('Failed to generate CSV export:', error);
            throw new DatabaseError('Failed to generate CSV export');
        }
    }
    async saveTemplate(userId, template) {
        await this.ensureInitialized();
        try {
            const now = new Date();
            const newTemplate = {
                _id: new ObjectId(),
                ...template,
                userId,
                createdAt: now,
                updatedAt: now,
            };
            await this.exportTemplatesCollection.insertOne(newTemplate);
            return newTemplate;
        }
        catch (error) {
            logger.error('Failed to save export template:', error);
            throw new DatabaseError('Failed to save export template');
        }
    }
    async getTemplate(templateId) {
        await this.ensureInitialized();
        try {
            return this.exportTemplatesCollection.findOne({ _id: templateId });
        }
        catch (error) {
            logger.error('Failed to get export template:', error);
            throw new DatabaseError('Failed to get export template');
        }
    }
    async getTemplates(userId) {
        await this.ensureInitialized();
        try {
            return this.exportTemplatesCollection
                .find({
                $or: [{ userId }, { isPublic: true }],
            })
                .toArray();
        }
        catch (error) {
            logger.error('Failed to get export templates:', error);
            throw new DatabaseError('Failed to get export templates');
        }
    }
    async deleteTemplate(templateId, userId) {
        await this.ensureInitialized();
        try {
            const result = await this.exportTemplatesCollection.deleteOne({
                _id: templateId,
                userId,
                isDefault: { $ne: true },
            });
            return result.deletedCount > 0;
        }
        catch (error) {
            logger.error('Failed to delete export template:', error);
            throw new DatabaseError('Failed to delete export template');
        }
    }
}
//# sourceMappingURL=export.service.js.map
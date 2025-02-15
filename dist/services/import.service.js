import { Db } from 'mongodb';
import { connectToDatabase } from '../db.js';
import logger from '../utils/logger.js';
import { StorageService } from '../storage.service.js';
import { NotificationManagerService } from '../notification-manager.service.js';
import { ImportJob, ImportOptions, ImportFormat, ImportMapping, ImportResult, FormatDetectionResult, } from '../types/export.js';
import { ParserOptions } from '../utils/recipe-parser.js';
import { detectFormat } from '../utils/format-detector.js';
import { NotificationChannel } from '../types/index.js';
import { DatabaseError, ValidationError, NotFoundError } from '../utils/errors.js';
export class ImportService {
    constructor() {
        this.initialized = false;
        this.storageService = StorageService.getInstance();
        this.recipeService = RecipeService.getInstance();
        this.notificationService = NotificationManagerService.getInstance();
        this.initialize().catch(error => {
            logger.error('Failed to initialize ImportService:', error);
        });
    }
    async initialize() {
        if (this.initialized)
            return;
        try {
            this.db = await connectToDatabase();
            this.importJobsCollection = this.db.collection('import_jobs');
            this.importMappingsCollection = this.db.collection('import_mappings');
            this.initialized = true;
            logger.info('ImportService initialized successfully');
        }
        catch (error) {
            logger.error('Failed to initialize ImportService:', error);
            throw new DatabaseError('Failed to initialize ImportService');
        }
    }
    async ensureInitialized() {
        if (!this.initialized) {
            await this.initialize();
        }
    }
    static getInstance() {
        if (!ImportService.instance) {
            ImportService.instance = new ImportService();
        }
        return ImportService.instance;
    }
    validateImportOptions(options) {
        if (options.matchBy && !Array.isArray(options.matchBy)) {
            throw new ValidationError('matchBy must be an array');
        }
        if (options.defaultPrivacy && !['public', 'private'].includes(options.defaultPrivacy)) {
            throw new ValidationError('Invalid defaultPrivacy value');
        }
    }
    async createImportJob(userId, format, options, fileKey) {
        await this.ensureInitialized();
        this.validateImportOptions(options);
        try {
            const now = new Date();
            const job = {
                _id: new ObjectId(),
                userId,
                status: 'pending',
                format,
                options,
                fileKey,
                progress: 0,
                createdAt: now,
                updatedAt: now,
            };
            await this.importJobsCollection.insertOne(job);
            // Start processing in background
            this.processImportJob(job).catch(error => {
                logger.error('Failed to process import job:', error);
            });
            return job;
        }
        catch (error) {
            logger.error('Failed to create import job:', error);
            throw new DatabaseError('Failed to create import job');
        }
    }
    async getImportJob(jobId) {
        await this.ensureInitialized();
        try {
            return this.importJobsCollection.findOne({ _id: jobId });
        }
        catch (error) {
            logger.error('Failed to get import job:', error);
            throw new DatabaseError('Failed to get import job');
        }
    }
    async processImportJob(job) {
        await this.ensureInitialized();
        try {
            // Update status to processing
            await this.importJobsCollection.updateOne({ _id: job._id }, {
                $set: {
                    status: 'processing',
                    startedAt: new Date(),
                    updatedAt: new Date(),
                },
            });
            // Get file content
            const fileContent = await this.storageService.getFileContent(job.fileKey);
            // Detect format if not specified
            if (!job.format) {
                const detectionResult = await this.detectFileFormat(fileContent);
                if (!detectionResult.format) {
                    throw new ValidationError('Could not detect file format');
                }
                job.format = detectionResult.format;
            }
            // Parse recipes
            const result = await this.parseRecipes(fileContent, job.format, job.options);
            // Import recipes
            for (const recipe of result.recipes) {
                await this.recipeService.createRecipe(recipe);
            }
            // Update job with result
            await this.importJobsCollection.updateOne({ _id: job._id }, {
                $set: {
                    status: 'completed',
                    stats: result.stats,
                    progress: 100,
                    completedAt: new Date(),
                    updatedAt: new Date(),
                },
            });
            // Send notification
            await this.notificationService.sendNotification({
                userId: job.userId,
                type: 'import_completed',
                title: 'Import Completed',
                message: `Successfully imported ${result.stats.imported} recipes`,
                data: { jobId: job._id },
                channels: [NotificationChannel.IN_APP],
            });
        }
        catch (error) {
            logger.error('Import job failed:', error);
            // Update job with error
            await this.importJobsCollection.updateOne({ _id: job._id }, {
                $set: {
                    status: 'failed',
                    error: error instanceof Error ? error.message : 'Unknown error',
                    updatedAt: new Date(),
                },
            });
            // Send notification
            await this.notificationService.sendNotification({
                userId: job.userId,
                type: 'import_failed',
                title: 'Import Failed',
                message: 'There was an error importing your recipes',
                data: { jobId: job._id },
                channels: [NotificationChannel.IN_APP],
            });
        }
    }
    async parseRecipes(content, format, options) {
        const recipes = [];
        const errors = [];
        const warnings = [];
        let total = 0;
        let imported = 0;
        let skipped = 0;
        let failed = 0;
        let updated = 0;
        try {
            const recipeContents = this.splitRecipes(content, format);
            total = recipeContents.length;
            if (total === 0) {
                throw new ValidationError('No recipes found in file');
            }
            for (let i = 0; i < recipeContents.length; i++) {
                try {
                    const parserOptions = {
                        extractTimes: true,
                        extractTags: true,
                    };
                    const parseResult = await parseRecipe(recipeContents[i], parserOptions);
                    // Add any parser warnings
                    if (parseResult.warnings.length > 0) {
                        warnings.push({
                            index: i,
                            warning: 'Parser warnings',
                            data: parseResult.warnings,
                        });
                    }
                    // Validate recipe
                    const validationResult = validateRecipe(parseResult.recipe);
                    if (!validationResult.isValid) {
                        failed++;
                        errors.push({
                            index: i,
                            error: 'Invalid recipe data',
                            data: validationResult.errors,
                        });
                        continue;
                    }
                    // Convert to Recipe type
                    const recipe = convertToRecipe(parseResult.recipe);
                    // Check for duplicates if needed
                    if (options.skipDuplicates || options.updateExisting) {
                        const existing = await this.recipeService.findRecipeByTitle(recipe.title);
                        if (existing && existing._id) {
                            if (options.skipDuplicates) {
                                skipped++;
                                continue;
                            }
                            if (options.updateExisting) {
                                const updatedRecipe = await this.recipeService.updateRecipe(existing._id, {
                                    ...recipe,
                                    updatedAt: new Date(),
                                });
                                recipes.push(updatedRecipe);
                                updated++;
                                continue;
                            }
                        }
                    }
                    // Create new recipe
                    const recipeInput = {
                        title: recipe.title,
                        description: recipe.description,
                        ingredients: recipe.ingredients,
                        instructions: recipe.instructions,
                        servings: recipe.servings,
                        prepTime: recipe.prepTime,
                        cookTime: recipe.cookTime,
                        difficulty: recipe.difficulty,
                        cuisine: recipe.cuisine,
                        categories: recipe.categories,
                        tags: recipe.tags || [],
                        images: recipe.images || [],
                        image: recipe.image,
                        video: recipe.video,
                        language: recipe.language,
                        availableLanguages: recipe.availableLanguages,
                        nutritionalInfo: recipe.nutritionalInfo,
                        mealType: recipe.mealType,
                        visibility: options.defaultPrivacy || recipe.visibility || 'public',
                    };
                    const newRecipe = await this.recipeService.createRecipe(recipeInput);
                    // Sanitize recipe
                    const sanitizedRecipe = sanitizeRecipe(newRecipe);
                    // Add default tags if specified
                    if (options.defaultTags) {
                        sanitizedRecipe.tags = [...(sanitizedRecipe.tags || []), ...options.defaultTags];
                    }
                    recipes.push(sanitizedRecipe);
                    imported++;
                }
                catch (error) {
                    failed++;
                    errors.push({
                        index: i,
                        error: error instanceof Error ? error.message : 'Failed to parse recipe',
                        data: error,
                    });
                }
            }
            return {
                recipes,
                stats: {
                    total,
                    imported,
                    skipped,
                    failed,
                    updated,
                },
                errors,
                warnings,
            };
        }
        catch (error) {
            if (error instanceof ValidationError)
                throw error;
            logger.error('Failed to parse recipes:', error);
            throw new DatabaseError('Failed to parse recipes');
        }
    }
    async detectFileFormat(content) {
        try {
            return detectFormat(content);
        }
        catch (error) {
            logger.error('Failed to detect file format:', error);
            throw new DatabaseError('Failed to detect file format');
        }
    }
    splitRecipes(content, format) {
        // Implementation would depend on the format
        // For now, just return an array with the single content
        return [content];
    }
    async saveMapping(userId, mapping) {
        await this.ensureInitialized();
        try {
            const now = new Date();
            const newMapping = {
                _id: new ObjectId(),
                ...mapping,
                userId,
                createdAt: now,
                updatedAt: now,
            };
            await this.importMappingsCollection.insertOne(newMapping);
            return newMapping;
        }
        catch (error) {
            logger.error('Failed to save import mapping:', error);
            throw new DatabaseError('Failed to save import mapping');
        }
    }
    async getMapping(mappingId) {
        await this.ensureInitialized();
        try {
            return this.importMappingsCollection.findOne({ _id: mappingId });
        }
        catch (error) {
            logger.error('Failed to get import mapping:', error);
            throw new DatabaseError('Failed to get import mapping');
        }
    }
    async getMappings(userId) {
        await this.ensureInitialized();
        try {
            return this.importMappingsCollection
                .find({
                $or: [{ userId }, { isPublic: true }],
            })
                .toArray();
        }
        catch (error) {
            logger.error('Failed to get import mappings:', error);
            throw new DatabaseError('Failed to get import mappings');
        }
    }
    async deleteMapping(mappingId, userId) {
        await this.ensureInitialized();
        try {
            const result = await this.importMappingsCollection.deleteOne({
                _id: mappingId,
                userId,
                isDefault: { $ne: true },
            });
            return result.deletedCount > 0;
        }
        catch (error) {
            logger.error('Failed to delete import mapping:', error);
            throw new DatabaseError('Failed to delete import mapping');
        }
    }
}
//# sourceMappingURL=import.service.js.map
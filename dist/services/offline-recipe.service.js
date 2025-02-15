import { DatabaseService } from '../db/database.service.js';
import { CacheService } from '../cache.service.js';
import { OfflineSyncService } from '../offline-sync.service.js';
import logger from '../utils/logger.js';
import { DatabaseError, ValidationError, NotFoundError, ConflictError } from '../utils/errors.js';
// Helper function to ensure author exists
function getAuthorId(recipe) {
    if (!recipe.author?._id) {
        throw new ValidationError('Recipe must have an author');
    }
    return recipe.author._id;
}
export class OfflineRecipeService {
    constructor() {
        this.initialized = false;
        this.CACHE_TTL = 30 * 24 * 60 * 60; // 30 days
        this.db = DatabaseService.getInstance();
        this.cacheService = CacheService.getInstance();
        this.syncService = OfflineSyncService.getInstance();
        this.initialize().catch(error => {
            logger.error('Failed to initialize OfflineRecipeService:', error);
        });
    }
    async initialize() {
        if (this.initialized)
            return;
        try {
            await this.db.connect();
            this.recipesCollection = this.db.getCollection('recipes');
            this.initialized = true;
            logger.info('OfflineRecipeService initialized successfully');
        }
        catch (error) {
            logger.error('Failed to initialize OfflineRecipeService:', error);
            throw error;
        }
    }
    async ensureInitialized() {
        if (!this.initialized) {
            await this.initialize();
        }
    }
    static getInstance() {
        if (!OfflineRecipeService.instance) {
            OfflineRecipeService.instance = new OfflineRecipeService();
        }
        return OfflineRecipeService.instance;
    }
    validateRecipe(recipe) {
        if (!recipe._id) {
            throw new ValidationError('Recipe must have an _id');
        }
        if (!recipe.author?._id) {
            throw new ValidationError('Recipe must have an author');
        }
    }
    async getCacheKey(recipeId) {
        return `offline_recipe:${recipeId.toString()}`;
    }
    async saveOffline(recipe) {
        await this.ensureInitialized();
        this.validateRecipe(recipe);
        try {
            const authorId = getAuthorId(recipe);
            const offlineRecipe = {
                ...recipe,
                version: 1,
                lastModified: new Date(),
                syncStatus: 'synced',
                lastSynced: new Date(),
                stats: {
                    viewCount: recipe.stats?.viewCount || 0,
                    rating: recipe.stats?.rating || 0
                }
            };
            const key = await this.getCacheKey(recipe._id);
            await this.cacheService.set(key, offlineRecipe, {
                ttl: this.CACHE_TTL,
            });
            // Record sync operation
            const operation = {
                userId: authorId,
                deviceId: 'local',
                type: 'create',
                collection: 'recipes',
                documentId: recipe._id,
                changes: recipe,
                version: 1,
                timestamp: new Date(),
            };
            await this.syncService.recordOperation(operation);
        }
        catch (error) {
            logger.error('Failed to save recipe offline:', error);
            throw new DatabaseError('Failed to save recipe offline');
        }
    }
    async getOffline(recipeId) {
        await this.ensureInitialized();
        try {
            const key = await this.getCacheKey(recipeId);
            return await this.cacheService.get(key);
        }
        catch (error) {
            logger.error('Failed to get offline recipe:', error);
            throw new DatabaseError('Failed to get offline recipe');
        }
    }
    async updateOffline(recipeId, updates) {
        await this.ensureInitialized();
        try {
            const existingRecipe = await this.getOffline(recipeId);
            if (!existingRecipe) {
                throw new NotFoundError('Recipe not found in offline storage');
            }
            const authorId = getAuthorId(existingRecipe);
            const updatedRecipe = {
                ...existingRecipe,
                ...updates,
                version: existingRecipe.version + 1,
                lastModified: new Date(),
                syncStatus: 'pending',
                stats: {
                    viewCount: existingRecipe.stats?.viewCount || 0,
                    rating: existingRecipe.stats?.rating || 0
                }
            };
            const key = await this.getCacheKey(recipeId);
            await this.cacheService.set(key, updatedRecipe, {
                ttl: this.CACHE_TTL,
            });
            // Record sync operation
            const operation = {
                userId: authorId,
                deviceId: 'local',
                type: 'update',
                collection: 'recipes',
                documentId: recipeId,
                changes: updates,
                version: updatedRecipe.version,
                timestamp: new Date(),
            };
            await this.syncService.recordOperation(operation);
        }
        catch (error) {
            if (error instanceof NotFoundError || error instanceof ValidationError) {
                throw error;
            }
            logger.error('Failed to update offline recipe:', error);
            throw new DatabaseError('Failed to update offline recipe');
        }
    }
    async deleteOffline(recipeId) {
        await this.ensureInitialized();
        try {
            const recipe = await this.getOffline(recipeId);
            if (!recipe) {
                throw new NotFoundError('Recipe not found in offline storage');
            }
            const authorId = getAuthorId(recipe);
            const key = await this.getCacheKey(recipeId);
            await this.cacheService.delete(key);
            // Record sync operation
            const operation = {
                userId: authorId,
                deviceId: 'local',
                type: 'delete',
                collection: 'recipes',
                documentId: recipeId,
                changes: {},
                version: recipe.version + 1,
                timestamp: new Date(),
            };
            await this.syncService.recordOperation(operation);
        }
        catch (error) {
            if (error instanceof NotFoundError || error instanceof ValidationError) {
                throw error;
            }
            logger.error('Failed to delete offline recipe:', error);
            throw new DatabaseError('Failed to delete offline recipe');
        }
    }
    async getAllOffline(userId) {
        await this.ensureInitialized();
        try {
            const recipes = await this.recipesCollection.find({ 'author._id': userId }).toArray();
            // Cache all recipes
            await Promise.all(recipes.map(recipe => this.saveOffline(recipe)));
            const offlineRecipes = await Promise.all(recipes.map(recipe => this.getOffline(recipe._id)));
            return offlineRecipes.filter((recipe) => recipe !== null);
        }
        catch (error) {
            logger.error('Failed to get all offline recipes:', error);
            throw new DatabaseError('Failed to get all offline recipes');
        }
    }
    async syncOfflineChanges(userId) {
        await this.ensureInitialized();
        try {
            const pendingRecipes = await this.getAllOffline(userId);
            const recipesToSync = pendingRecipes.filter(recipe => recipe.syncStatus === 'pending');
            for (const recipe of recipesToSync) {
                const serverRecipe = await this.recipesCollection.findOne({ _id: recipe._id });
                if (!serverRecipe) {
                    // Recipe was deleted on server
                    await this.deleteOffline(recipe._id);
                    continue;
                }
                // Convert server recipe to versioned type
                const versionedServerRecipe = {
                    ...serverRecipe,
                    version: serverRecipe.version ?? 1,
                    lastModified: serverRecipe.lastModified ?? new Date(),
                };
                if (versionedServerRecipe.version > recipe.version) {
                    // Server has newer version
                    recipe.serverVersion = versionedServerRecipe;
                    recipe.syncStatus = 'conflict';
                    await this.cacheService.set(await this.getCacheKey(recipe._id), recipe, {
                        ttl: this.CACHE_TTL,
                    });
                }
                else {
                    // Safe to sync local changes
                    const { syncStatus, lastSynced, serverVersion, ...cleanRecipe } = recipe;
                    await this.recipesCollection.updateOne({ _id: recipe._id }, { $set: cleanRecipe });
                    const updatedRecipe = {
                        ...recipe,
                        syncStatus: 'synced',
                        lastSynced: new Date(),
                    };
                    await this.cacheService.set(await this.getCacheKey(recipe._id), updatedRecipe, {
                        ttl: this.CACHE_TTL,
                    });
                }
            }
        }
        catch (error) {
            logger.error('Failed to sync offline changes:', error);
            throw new DatabaseError('Failed to sync offline changes');
        }
    }
    async checkConflicts(userId) {
        await this.ensureInitialized();
        try {
            const allRecipes = await this.getAllOffline(userId);
            return allRecipes.filter(recipe => recipe.syncStatus === 'conflict');
        }
        catch (error) {
            logger.error('Failed to check conflicts:', error);
            throw new DatabaseError('Failed to check conflicts');
        }
    }
    async resolveConflict(recipeId, resolution) {
        await this.ensureInitialized();
        try {
            const recipe = await this.getOffline(recipeId);
            if (!recipe) {
                throw new NotFoundError('Recipe not found');
            }
            if (recipe.syncStatus !== 'conflict') {
                throw new ConflictError('Recipe is not in conflict state');
            }
            if (!recipe.serverVersion) {
                throw new ConflictError('Server version not available');
            }
            const authorId = getAuthorId(recipe);
            if (resolution === 'local') {
                // Keep local changes and force sync
                await this.updateOffline(recipeId, {});
                await this.syncOfflineChanges(authorId);
            }
            else {
                // Use server version
                const { version, lastModified } = recipe.serverVersion;
                const updatedRecipe = {
                    ...recipe.serverVersion,
                    version,
                    lastModified,
                    syncStatus: 'synced',
                    lastSynced: new Date(),
                    stats: {
                        viewCount: recipe.stats?.viewCount || 0,
                        rating: recipe.stats?.rating || 0
                    }
                };
                await this.cacheService.set(await this.getCacheKey(recipeId), updatedRecipe, {
                    ttl: this.CACHE_TTL,
                });
            }
        }
        catch (error) {
            if (error instanceof NotFoundError || error instanceof ConflictError) {
                throw error;
            }
            logger.error('Failed to resolve conflict:', error);
            throw new DatabaseError('Failed to resolve conflict');
        }
    }
    async preCacheRecipes(userId, options = {}) {
        await this.ensureInitialized();
        try {
            const query = { 'author._id': userId };
            const total = await this.recipesCollection.countDocuments(query);
            let processed = 0;
            const cursor = this.recipesCollection.find(query).limit(options.limit || total);
            while (await cursor.hasNext()) {
                const recipe = await cursor.next();
                if (recipe) {
                    await this.saveOffline(recipe);
                    processed++;
                    if (options.onProgress) {
                        options.onProgress(Math.round((processed / total) * 100));
                    }
                }
            }
        }
        catch (error) {
            logger.error('Failed to pre-cache recipes:', error);
            throw new DatabaseError('Failed to pre-cache recipes');
        }
    }
}
//# sourceMappingURL=offline-recipe.service.js.map
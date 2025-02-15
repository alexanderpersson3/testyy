import { ObjectId } from 'mongodb';
;
import { DatabaseService } from '../../db/database.service.js';
import { ModerationService } from '../moderationService.js';
import logger from '../../utils/logger.js';
import { DatabaseError } from '../../utils/errors.js';
import { connectToDatabase } from '../../db/database.service.js';
export class CMSService {
    constructor() {
        this.db = DatabaseService.getInstance();
        connectToDatabase().then(db => {
            this.moderationService = new ModerationService(db);
        }).catch(error => {
            logger.error('Failed to initialize ModerationService:', error);
            throw error;
        });
    }
    static getInstance() {
        if (!CMSService.instance) {
            CMSService.instance = new CMSService();
        }
        return CMSService.instance;
    }
    /**
     * Create or update a recipe
     */
    async upsertRecipe(recipe) {
        try {
            const collection = this.db.getCollection('recipes');
            const now = new Date();
            if (recipe._id) {
                // Get existing recipe for comparison
                const existingRecipe = await collection.findOne({ _id: recipe._id });
                if (!existingRecipe) {
                    throw new Error('Recipe not found');
                }
                // Create version with changes
                const changes = this.detectRecipeChanges(existingRecipe, recipe);
                if (changes.length > 0 && recipe.createdBy) {
                    await this.createRecipeVersion(recipe._id, changes, recipe, recipe.createdBy);
                }
                // Update existing recipe
                const result = await collection.findOneAndUpdate({ _id: recipe._id }, {
                    $set: {
                        ...recipe,
                        updatedAt: now,
                    },
                }, { returnDocument: 'after' });
                if (!result.value) {
                    throw new Error('Recipe not found');
                }
                return result.value;
            }
            else {
                // Create new recipe
                const newRecipe = {
                    ...recipe,
                    createdAt: now,
                    updatedAt: now,
                    stats: {
                        viewCount: 0,
                        saveCount: 0,
                        rating: 0,
                        likes: 0,
                        shares: 0,
                        comments: 0,
                    },
                };
                const result = await collection.insertOne(newRecipe);
                return { ...newRecipe, _id: result.insertedId };
            }
        }
        catch (error) {
            logger.error('Failed to upsert recipe:', error);
            throw new DatabaseError('Failed to upsert recipe');
        }
    }
    /**
     * Get recipe analytics
     */
    async getRecipeAnalytics(recipeId, period) {
        try {
            const recipe = await this.db.getCollection('recipes').findOne({ _id: recipeId });
            if (!recipe) {
                throw new Error('Recipe not found');
            }
            const now = new Date();
            const periodStart = new Date();
            switch (period) {
                case 'day':
                    periodStart.setDate(now.getDate() - 1);
                    break;
                case 'week':
                    periodStart.setDate(now.getDate() - 7);
                    break;
                case 'month':
                    periodStart.setMonth(now.getMonth() - 1);
                    break;
                case 'year':
                    periodStart.setFullYear(now.getFullYear() - 1);
                    break;
            }
            // Get daily views
            const dailyViews = await this.db
                .getCollection('recipe_views')
                .aggregate([
                {
                    $match: {
                        recipeId: recipeId,
                        timestamp: { $gte: periodStart, $lte: now },
                    },
                },
                {
                    $group: {
                        _id: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } },
                        count: { $sum: 1 },
                    },
                },
                {
                    $sort: { _id: 1 },
                },
            ])
                .toArray();
            return {
                viewCount: recipe.stats?.viewCount || 0,
                saveCount: recipe.stats?.saveCount || 0,
                likeCount: recipe.stats?.likes || 0,
                commentCount: recipe.stats?.comments || 0,
                averageRating: recipe.ratings?.average || 0,
                ratingCount: recipe.ratings?.count || 0,
                periodStart,
                periodEnd: now,
                dailyViews: dailyViews.map(dv => ({ date: dv._id, count: dv.count })),
            };
        }
        catch (error) {
            logger.error('Failed to get recipe analytics:', error);
            throw new DatabaseError('Failed to get recipe analytics');
        }
    }
    /**
     * Add recipe to moderation queue
     */
    async submitForModeration(recipeId, submittedBy) {
        if (!this.moderationService) {
            throw new Error('ModerationService not initialized');
        }
        try {
            const queueItem = {
                recipeId,
                submittedBy,
                submittedAt: new Date(),
                status: 'pending',
            };
            await this.db.getCollection('moderation_queue').insertOne(queueItem);
        }
        catch (error) {
            logger.error('Failed to submit recipe for moderation:', error);
            throw new DatabaseError('Failed to submit recipe for moderation');
        }
    }
    /**
     * Get moderation queue
     */
    async getModerationQueue(status) {
        if (!this.moderationService) {
            throw new Error('ModerationService not initialized');
        }
        try {
            const query = status ? { status } : {};
            return await this.db
                .getCollection('moderation_queue')
                .find(query)
                .sort({ submittedAt: 1 })
                .toArray();
        }
        catch (error) {
            logger.error('Failed to get moderation queue:', error);
            throw new DatabaseError('Failed to get moderation queue');
        }
    }
    /**
     * Review recipe in moderation queue
     */
    async reviewRecipe(queueItemId, reviewedBy, status, notes) {
        if (!this.moderationService) {
            throw new Error('ModerationService not initialized');
        }
        try {
            const queueItem = await this.db.getCollection('moderation_queue').findOne({
                _id: queueItemId,
            });
            if (!queueItem) {
                throw new Error('Queue item not found');
            }
            await this.db.getCollection('moderation_queue').updateOne({ _id: queueItemId }, {
                $set: {
                    status,
                    reviewedBy,
                    reviewedAt: new Date(),
                    notes: notes || [],
                },
            });
            // Update recipe status
            await this.db.getCollection('recipes').updateOne({ _id: queueItem.recipeId }, {
                $set: {
                    status: status === 'approved' ? 'published' : status === 'rejected' ? 'rejected' : 'draft',
                    updatedAt: new Date(),
                },
            });
        }
        catch (error) {
            logger.error('Failed to review recipe:', error);
            throw new DatabaseError('Failed to review recipe');
        }
    }
    /**
     * Manage taxonomy
     */
    async upsertTaxonomyItem(item) {
        try {
            const collection = this.db.getCollection('taxonomy');
            const now = new Date();
            if (item._id) {
                // Update existing item
                const result = await collection.findOneAndUpdate({ _id: item._id }, {
                    $set: {
                        ...item,
                        updatedAt: now,
                    },
                }, { returnDocument: 'after' });
                if (!result.value) {
                    throw new Error('Taxonomy item not found');
                }
                return result.value;
            }
            else {
                // Create new item
                const newItem = {
                    ...item,
                    count: 0,
                    createdAt: now,
                    updatedAt: now,
                };
                const result = await collection.insertOne(newItem);
                return { ...newItem, _id: result.insertedId };
            }
        }
        catch (error) {
            logger.error('Failed to upsert taxonomy item:', error);
            throw new DatabaseError('Failed to upsert taxonomy item');
        }
    }
    /**
     * Get taxonomy items
     */
    async getTaxonomyItems(type) {
        try {
            const query = type ? { type } : {};
            return await this.db.getCollection('taxonomy').find(query).sort({ name: 1 }).toArray();
        }
        catch (error) {
            logger.error('Failed to get taxonomy items:', error);
            throw new DatabaseError('Failed to get taxonomy items');
        }
    }
    /**
     * Delete taxonomy item
     */
    async deleteTaxonomyItem(itemId) {
        try {
            const result = await this.db.getCollection('taxonomy').deleteOne({ _id: itemId });
            if (result.deletedCount === 0) {
                throw new Error('Taxonomy item not found');
            }
        }
        catch (error) {
            logger.error('Failed to delete taxonomy item:', error);
            throw new DatabaseError('Failed to delete taxonomy item');
        }
    }
    /**
     * Create a new version of a recipe
     */
    async createRecipeVersion(recipeId, changes, data, userId) {
        try {
            // Get latest version number
            const latestVersion = await this.db
                .getCollection('recipe_versions')
                .findOne({ recipeId }, { sort: { version: -1 }, projection: { version: 1 } });
            const version = latestVersion ? latestVersion.version + 1 : 1;
            // Create new version
            const recipeVersion = {
                recipeId,
                version,
                changes,
                data,
                createdBy: userId,
                createdAt: new Date(),
            };
            const result = await this.db
                .getCollection('recipe_versions')
                .insertOne(recipeVersion);
            return { ...recipeVersion, _id: result.insertedId };
        }
        catch (error) {
            logger.error('Failed to create recipe version:', error);
            throw new DatabaseError('Failed to create recipe version');
        }
    }
    /**
     * Get recipe versions
     */
    async getRecipeVersions(recipeId) {
        try {
            return await this.db
                .getCollection('recipe_versions')
                .find({ recipeId })
                .sort({ version: -1 })
                .toArray();
        }
        catch (error) {
            logger.error('Failed to get recipe versions:', error);
            throw new DatabaseError('Failed to get recipe versions');
        }
    }
    /**
     * Restore recipe to a specific version
     */
    async restoreRecipeVersion(recipeId, version) {
        try {
            const recipeVersion = await this.db
                .getCollection('recipe_versions')
                .findOne({ recipeId, version });
            if (!recipeVersion) {
                throw new Error('Recipe version not found');
            }
            // Update recipe with version data
            const result = await this.db
                .getCollection('recipes')
                .findOneAndUpdate({ _id: recipeId }, {
                $set: {
                    ...recipeVersion.data,
                    updatedAt: new Date(),
                },
            }, { returnDocument: 'after' });
            if (!result.value) {
                throw new Error('Recipe not found');
            }
            return result.value;
        }
        catch (error) {
            logger.error('Failed to restore recipe version:', error);
            throw new DatabaseError('Failed to restore recipe version');
        }
    }
    /**
     * Detect changes between recipe versions
     */
    detectRecipeChanges(oldRecipe, newRecipe) {
        const changes = [];
        // Compare basic fields
        if (newRecipe.title && newRecipe.title !== oldRecipe.title) {
            changes.push('Title updated');
        }
        if (newRecipe.description && newRecipe.description !== oldRecipe.description) {
            changes.push('Description updated');
        }
        if (newRecipe.servings && newRecipe.servings !== oldRecipe.servings) {
            changes.push('Servings updated');
        }
        if (newRecipe.prepTime && newRecipe.prepTime !== oldRecipe.prepTime) {
            changes.push('Preparation time updated');
        }
        if (newRecipe.cookTime && newRecipe.cookTime !== oldRecipe.cookTime) {
            changes.push('Cooking time updated');
        }
        if (newRecipe.difficulty && newRecipe.difficulty !== oldRecipe.difficulty) {
            changes.push('Difficulty updated');
        }
        if (newRecipe.cuisine && newRecipe.cuisine !== oldRecipe.cuisine) {
            changes.push('Cuisine updated');
        }
        // Compare ingredients
        if (newRecipe.ingredients) {
            const oldIngredients = JSON.stringify(oldRecipe.ingredients);
            const newIngredients = JSON.stringify(newRecipe.ingredients);
            if (oldIngredients !== newIngredients) {
                changes.push('Ingredients updated');
            }
        }
        // Compare instructions
        if (newRecipe.instructions) {
            const oldInstructions = JSON.stringify(oldRecipe.instructions);
            const newInstructions = JSON.stringify(newRecipe.instructions);
            if (oldInstructions !== newInstructions) {
                changes.push('Instructions updated');
            }
        }
        // Compare tags
        if (newRecipe.tags) {
            const oldTags = new Set(oldRecipe.tags);
            const newTags = new Set(newRecipe.tags);
            if (oldTags.size !== newTags.size ||
                !oldRecipe.tags.every(tag => newTags.has(tag)) ||
                !newRecipe.tags.every(tag => oldTags.has(tag))) {
                changes.push('Tags updated');
            }
        }
        return changes;
    }
}
CMSService.instance = null;
//# sourceMappingURL=cms.service.js.map
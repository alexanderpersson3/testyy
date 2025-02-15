import { ObjectId } from 'mongodb';
;
import { DatabaseService } from '../db/database.service.js';
import { WebSocketService } from '../services/websocket.service.js';
import logger from '../utils/logger.js';
import { NotFoundError, InternalServerError } from '../utils/errors.js';
export class RecipeService {
    constructor() {
        this.initialized = false;
        this.db = DatabaseService.getInstance();
        this.wsService = WebSocketService.getInstance();
        this.initialize().catch(error => {
            logger.error('Failed to initialize RecipeService:', error);
        });
    }
    static getInstance() {
        if (!RecipeService.instance) {
            RecipeService.instance = new RecipeService();
        }
        return RecipeService.instance;
    }
    async initialize() {
        if (this.initialized)
            return;
        try {
            await this.db.connect();
            this.recipesCollection = this.db.getCollection('recipes');
            this.likesCollection = this.db.getCollection('recipe_likes');
            this.reportsCollection = this.db.getCollection('recipe_reports');
            await Promise.all([
                this.recipesCollection.createIndex({ 'author._id': 1 }),
                this.recipesCollection.createIndex({ tags: 1 }),
                this.recipesCollection.createIndex({ 'ratings.average': -1 }),
                this.likesCollection.createIndex({ recipeId: 1, userId: 1 }, { unique: true }),
                this.reportsCollection.createIndex({ recipeId: 1, userId: 1 }),
            ]);
            this.initialized = true;
            logger.info('RecipeService initialized successfully');
        }
        catch (error) {
            logger.error('Failed to initialize RecipeService:', error);
            throw error;
        }
    }
    async ensureInitialized() {
        if (!this.initialized) {
            await this.initialize();
        }
    }
    async createRecipe(recipe) {
        await this.ensureInitialized();
        try {
            const now = new Date();
            const newRecipe = {
                _id: new ObjectId(),
                ...recipe,
                createdAt: now,
                updatedAt: now,
                stats: {
                    viewCount: 0,
                    rating: 0
                }
            };
            await this.recipesCollection.insertOne(newRecipe);
            this.wsService.broadcast('recipe:created', newRecipe);
            return newRecipe;
        }
        catch (error) {
            logger.error('Failed to create recipe:', error);
            throw new InternalServerError('Failed to create recipe');
        }
    }
    async getRecipe(recipeId) {
        await this.ensureInitialized();
        try {
            const recipe = await this.recipesCollection.findOne({ _id: recipeId });
            if (!recipe) {
                throw new NotFoundError('Recipe not found');
            }
            return recipe;
        }
        catch (error) {
            if (error instanceof NotFoundError)
                throw error;
            logger.error('Failed to get recipe:', error);
            throw new InternalServerError('Failed to get recipe');
        }
    }
    async getRecipes(recipeIds) {
        await this.ensureInitialized();
        try {
            return this.recipesCollection.find({ _id: { $in: recipeIds } }).toArray();
        }
        catch (error) {
            logger.error('Failed to get recipes:', error);
            throw new InternalServerError('Failed to get recipes');
        }
    }
    async updateRecipe(recipeId, update) {
        await this.ensureInitialized();
        try {
            const currentRecipe = await this.getRecipe(recipeId);
            const now = new Date();
            const updateOperation = {
                $set: {
                    ...update,
                    updatedAt: now,
                    totalTime: update.prepTime || update.cookTime
                        ? (update.prepTime || currentRecipe.prepTime || 0) +
                            (update.cookTime || currentRecipe.cookTime || 0)
                        : currentRecipe.totalTime ?? 0,
                    stats: {
                        ...currentRecipe.stats,
                        ...update.stats
                    }
                }
            };
            const result = await this.recipesCollection.findOneAndUpdate({ _id: recipeId }, updateOperation, { returnDocument: 'after' });
            if (!result.value) {
                throw new NotFoundError('Recipe not found');
            }
            this.wsService.broadcast('recipe:updated', { recipeId, update: result.value });
            return result.value;
        }
        catch (error) {
            if (error instanceof NotFoundError)
                throw error;
            logger.error('Failed to update recipe:', error);
            throw new InternalServerError('Failed to update recipe');
        }
    }
    async deleteRecipe(recipeId) {
        await this.ensureInitialized();
        try {
            const result = await this.recipesCollection.deleteOne({ _id: recipeId });
            this.wsService.broadcast('recipe:deleted', recipeId.toString());
            return result.deletedCount > 0;
        }
        catch (error) {
            logger.error('Failed to delete recipe:', error);
            throw new InternalServerError('Failed to delete recipe');
        }
    }
    async searchRecipes(query) {
        await this.ensureInitialized();
        try {
            const filter = {};
            if (query.text) {
                filter.$text = { $search: query.text };
            }
            if (query.cuisine) {
                filter.cuisine = query.cuisine;
            }
            if (query.difficulty) {
                filter.difficulty = query.difficulty;
            }
            if (query.tags?.length) {
                filter.tags = { $all: query.tags };
            }
            const options = {
                limit: query.limit || 20,
                skip: query.offset || 0,
                sort: [[query.sortBy || 'createdAt', -1]]
            };
            return this.recipesCollection.find(filter, options).toArray();
        }
        catch (error) {
            logger.error('Failed to search recipes:', error);
            throw new InternalServerError('Failed to search recipes');
        }
    }
    async updateRating(recipeId, rating) {
        await this.ensureInitialized();
        try {
            const recipe = await this.getRecipe(recipeId);
            const ratings = recipe.ratings ?? { average: 0, count: 0 };
            const newCount = ratings.count + 1;
            const newAverage = (ratings.average * ratings.count + rating) / newCount;
            await this.recipesCollection.updateOne({ _id: recipeId }, {
                $set: {
                    'ratings.average': Number(newAverage.toFixed(2)),
                    'ratings.count': newCount,
                    'stats.rating': Number(newAverage.toFixed(2)),
                    updatedAt: new Date()
                }
            });
        }
        catch (error) {
            if (error instanceof NotFoundError)
                throw error;
            logger.error('Failed to update recipe rating:', error);
            throw new InternalServerError('Failed to update rating');
        }
    }
    async getRecipesByAuthor(authorId) {
        await this.ensureInitialized();
        try {
            return this.recipesCollection
                .find({ 'author._id': authorId })
                .sort({ createdAt: -1 })
                .toArray();
        }
        catch (error) {
            logger.error('Failed to get recipes by author:', error);
            throw new InternalServerError('Failed to get recipes by author');
        }
    }
    async getRecipesByTags(tags) {
        await this.ensureInitialized();
        try {
            return this.recipesCollection
                .find({ tags: { $all: tags } })
                .sort({ 'ratings.average': -1 })
                .toArray();
        }
        catch (error) {
            logger.error('Failed to get recipes by tags:', error);
            throw new InternalServerError('Failed to get recipes by tags');
        }
    }
    async getPopularRecipes(limit = 10) {
        await this.ensureInitialized();
        try {
            return this.recipesCollection
                .find({})
                .sort({ 'ratings.average': -1, 'ratings.count': -1 })
                .limit(limit)
                .toArray();
        }
        catch (error) {
            logger.error('Failed to get popular recipes:', error);
            throw new InternalServerError('Failed to get popular recipes');
        }
    }
    async findRecipeByTitle(title) {
        await this.ensureInitialized();
        try {
            return this.recipesCollection.findOne({ title });
        }
        catch (error) {
            logger.error('Failed to find recipe by title:', error);
            throw new InternalServerError('Failed to find recipe by title');
        }
    }
    async toggleLike(recipeId, userId) {
        await this.ensureInitialized();
        try {
            const existingLike = await this.likesCollection.findOne({ recipeId, userId });
            if (existingLike) {
                await Promise.all([
                    this.likesCollection.deleteOne({ _id: existingLike._id }),
                    this.recipesCollection.updateOne({ _id: recipeId }, { $inc: { 'stats.likes': -1 } })
                ]);
                return false;
            }
            const now = new Date();
            const newLike = {
                _id: new ObjectId(),
                userId,
                recipeId,
                createdAt: now,
                updatedAt: now
            };
            await Promise.all([
                this.likesCollection.insertOne(newLike),
                this.recipesCollection.updateOne({ _id: recipeId }, { $inc: { 'stats.likes': 1 } })
            ]);
            return true;
        }
        catch (error) {
            logger.error('Failed to toggle recipe like:', error);
            throw new InternalServerError('Failed to toggle like');
        }
    }
    async getRecipeLikes(recipeId, options = {}) {
        await this.ensureInitialized();
        try {
            const page = options.page || 1;
            const limit = Math.min(options.limit || 20, 50);
            const skip = (page - 1) * limit;
            const pipeline = [{ $match: { recipeId } }];
            if (options.includeUser) {
                pipeline.push({
                    $lookup: {
                        from: 'users',
                        localField: 'userId',
                        foreignField: '_id',
                        as: 'user'
                    }
                }, { $unwind: '$user' });
                if (options.excludeFields?.length) {
                    const projection = {
                        _id: 1,
                        userId: 1,
                        recipeId: 1,
                        createdAt: 1,
                        'user._id': 1,
                        'user.name': 1
                    };
                    options.excludeFields.forEach(field => {
                        projection[field] = 0;
                    });
                    pipeline.push({ $project: projection });
                }
            }
            pipeline.push({ $sort: { createdAt: -1 } }, { $skip: skip }, { $limit: limit });
            const [likes, total] = await Promise.all([
                this.likesCollection
                    .aggregate(pipeline)
                    .toArray(),
                this.likesCollection.countDocuments({ recipeId })
            ]);
            return { likes, total };
        }
        catch (error) {
            logger.error('Failed to get recipe likes:', error);
            throw new InternalServerError('Failed to get recipe likes');
        }
    }
    async reportRecipe(recipeId, userId, report) {
        await this.ensureInitialized();
        try {
            const now = new Date();
            const reportDoc = {
                _id: new ObjectId(),
                recipeId,
                userId,
                reason: report.reason,
                description: report.description ?? '',
                status: 'pending',
                createdAt: now,
                updatedAt: now
            };
            await this.reportsCollection.insertOne(reportDoc);
        }
        catch (error) {
            logger.error('Failed to report recipe:', error);
            throw new InternalServerError('Failed to report recipe');
        }
    }
    async remixRecipe(originalRecipeId, userId) {
        await this.ensureInitialized();
        try {
            const originalRecipe = await this.getRecipe(originalRecipeId);
            const { _id: _, ...recipeData } = originalRecipe;
            const now = new Date();
            const remixedRecipe = {
                _id: new ObjectId(),
                ...recipeData,
                title: `${originalRecipe.title} (Remix)`,
                remixedFrom: {
                    recipeId: originalRecipeId,
                    userId: originalRecipe.author?._id || userId
                },
                author: {
                    _id: userId,
                    name: 'User'
                },
                stats: {
                    viewCount: 0,
                    rating: 0,
                    likes: 0
                },
                createdAt: now,
                updatedAt: now
            };
            const result = await this.recipesCollection.insertOne(remixedRecipe);
            return result.insertedId;
        }
        catch (error) {
            logger.error('Failed to remix recipe:', error);
            throw new InternalServerError('Failed to remix recipe');
        }
    }
}
export const recipeService = RecipeService.getInstance();
//# sourceMappingURL=recipe.service.js.map
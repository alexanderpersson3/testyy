import express from 'express';
import { check, validationResult } from 'express-validator';
import { ObjectId } from 'mongodb';
import multer from 'multer';
import path from 'path';
import { auth } from '../middleware/auth.js';
import { connectToDatabase } from '../db/db.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { elasticClient } from '../services/elastic-client.js';
import { isRecipeSource } from '../types/search.js';
const router = express.Router();
// Configure multer for recipe image uploads
const dest = path.join(process.cwd(), 'uploads', 'recipes');
const fileFilter = (_req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    }
    else {
        cb(new Error('Invalid file type'), false);
    }
};
const upload = multer({
    dest,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter
});
// Get all recipes with optional sorting
router.get('/', asyncHandler(async (req, res) => {
    const sortBy = req.query.sortBy || 'title';
    const order = req.query.order || 'asc';
    // Validate sort parameters
    const allowedSortFields = ['title', 'createdAt', 'popularity', 'prepTime', 'cookTime', 'totalTime'];
    if (!allowedSortFields.includes(sortBy)) {
        return res.status(400).json({ message: 'Invalid sort field' });
    }
    const result = await elasticClient.search({
        index: 'recipes',
        body: {
            size: 50,
            sort: [
                {
                    [sortBy]: {
                        order: order
                    }
                }
            ],
            query: {
                match_all: {}
            }
        }
    });
    const recipes = result.hits.hits.map(hit => ({
        id: hit._id,
        ...hit._source,
        score: hit._score
    }));
    res.json({
        recipes,
        total: result.hits.total,
        sortBy,
        order
    });
}));
// Search recipes
router.get('/search', asyncHandler(async (req, res) => {
    const query = req.query.q;
    if (!query) {
        return res.status(400).json({ message: 'Search query is required' });
    }
    const result = await elasticClient.search({
        index: 'recipes',
        body: {
            query: {
                multi_match: {
                    query: query,
                    fields: ['title^2', 'cuisine', 'tags']
                }
            }
        }
    });
    res.json({
        data: result.hits.hits.map(hit => ({
            ...hit._source,
            score: hit._score
        }))
    });
}));
// Get recipe by ID
router.get('/:id', asyncHandler(async (req, res) => {
    const db = await connectToDatabase();
    const recipeId = new ObjectId(req.params.id);
    const recipe = await db.collection('recipes').findOne({ _id: recipeId });
    if (!recipe) {
        return res.status(404).json({ message: 'Recipe not found' });
    }
    // If recipe is private, check if user is owner
    if (recipe.isPrivate && (!req.user || recipe.userId.toString() !== req.user.id)) {
        return res.status(403).json({ message: 'Access denied' });
    }
    res.json(recipe);
}));
// Create new recipe
router.post('/', auth, upload.single('image'), [
    check('name').trim().notEmpty(),
    check('description').trim().notEmpty(),
    check('servings').isInt({ min: 1 }),
    check('prepTime').isInt({ min: 0 }),
    check('cookTime').isInt({ min: 0 }),
    check('ingredients').isArray(),
    check('instructions').isArray(),
    check('tags').optional().isArray(),
    check('difficulty').isIn(['easy', 'medium', 'hard']),
    check('cuisine').optional().trim(),
    check('isPrivate').optional().isBoolean(),
    check('isPro').optional().isBoolean()
], asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    const { name, description, ingredients, instructions, ...recipeData } = req.body;
    const newRecipe = {
        name,
        description,
        ingredients: JSON.parse(ingredients),
        instructions: JSON.parse(instructions),
        ...recipeData,
        authorId: new ObjectId(req.user.id),
        userId: new ObjectId(req.user.id),
        likes: 0,
        shares: 0,
        status: 'published',
        createdAt: new Date(),
        updatedAt: new Date()
    };
    if (req.file) {
        newRecipe.image = `/uploads/recipes/${req.file.filename}`;
    }
    const db = await connectToDatabase();
    const result = await db.collection('recipes').insertOne(newRecipe);
    // Add to activity feed
    await db.collection('user_activity').insertOne({
        userId: new ObjectId(req.user.id),
        type: 'recipe_create',
        recipeId: result.insertedId,
        createdAt: new Date()
    });
    res.status(201).json({
        success: true,
        recipeId: result.insertedId
    });
}));
// Update recipe
router.put('/:id', auth, upload.single('image'), [
    check('name').optional().trim().notEmpty(),
    check('description').optional().trim().notEmpty(),
    check('servings').optional().isInt({ min: 1 }),
    check('prepTime').optional().isInt({ min: 0 }),
    check('cookTime').optional().isInt({ min: 0 }),
    check('ingredients').optional().isArray(),
    check('instructions').optional().isArray(),
    check('tags').optional().isArray(),
    check('difficulty').optional().isIn(['easy', 'medium', 'hard']),
    check('cuisine').optional().trim(),
    check('isPrivate').optional().isBoolean(),
    check('isPro').optional().isBoolean()
], asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    const db = await connectToDatabase();
    const userId = new ObjectId(req.user.id);
    const recipeId = new ObjectId(req.params.id);
    // Verify ownership
    const recipe = await db.collection('recipes').findOne({
        _id: recipeId,
        userId
    });
    if (!recipe) {
        return res.status(404).json({ message: 'Recipe not found or unauthorized' });
    }
    const updateData = {
        ...req.body,
        updatedAt: new Date()
    };
    if (req.file) {
        updateData.image = `/uploads/recipes/${req.file.filename}`;
    }
    await db.collection('recipes').updateOne({ _id: recipeId }, { $set: updateData });
    res.json({ success: true });
}));
// Delete recipe
router.delete('/:id', auth, asyncHandler(async (req, res) => {
    const db = await connectToDatabase();
    const userId = new ObjectId(req.user.id);
    const recipeId = new ObjectId(req.params.id);
    const result = await db.collection('recipes').deleteOne({
        _id: recipeId,
        userId
    });
    if (result.deletedCount === 0) {
        return res.status(404).json({ message: 'Recipe not found or unauthorized' });
    }
    // Cleanup related data
    await Promise.all([
        db.collection('recipe_likes').deleteMany({ recipeId }),
        db.collection('cookbook_entries').deleteMany({ recipeId }),
        db.collection('recipe_reports').deleteMany({ recipeId })
    ]);
    res.json({ success: true });
}));
// Get recipe suggestions for autocomplete
router.get('/suggestions', asyncHandler(async (req, res) => {
    const query = req.query.q;
    if (!query || query.length < 2) {
        return res.status(400).json({ message: 'Query must be at least 2 characters long' });
    }
    const result = await elasticClient.search({
        index: 'recipes',
        body: {
            size: 10,
            query: {
                bool: {
                    should: [
                        {
                            prefix: {
                                "name.keyword": {
                                    value: query,
                                    boost: 2
                                }
                            }
                        },
                        {
                            match_phrase_prefix: {
                                name: {
                                    query: query,
                                    max_expansions: 10
                                }
                            }
                        },
                        {
                            match_phrase_prefix: {
                                "ingredients.name": {
                                    query: query,
                                    max_expansions: 5
                                }
                            }
                        }
                    ]
                }
            },
            _source: ['name', 'cuisine', 'difficulty']
        }
    });
    const suggestions = result.hits.hits
        .map(hit => {
        const source = hit._source;
        if (!source || !isRecipeSource(source))
            return null;
        const suggestion = {
            name: source.name,
            cuisine: source.cuisine,
            difficulty: source.difficulty,
            score: hit._score ?? 0
        };
        return suggestion;
    })
        .filter((suggestion) => suggestion !== null);
    res.json({
        suggestions
    });
}));
// Remix recipe
router.post('/:id/remix', auth, asyncHandler(async (req, res) => {
    const db = await connectToDatabase();
    const userId = new ObjectId(req.user.id);
    const originalRecipeId = new ObjectId(req.params.id);
    // Get original recipe
    const originalRecipe = await db.collection('recipes').findOne({ _id: originalRecipeId });
    if (!originalRecipe) {
        return res.status(404).json({ message: 'Recipe not found' });
    }
    // Create new recipe based on original
    const remixedRecipe = {
        ...originalRecipe,
        name: `${originalRecipe.name} (Remix)`,
        userId,
        remixedFrom: {
            recipeId: originalRecipeId,
            userId: originalRecipe.userId
        },
        createdAt: new Date(),
        updatedAt: new Date()
    };
    delete remixedRecipe._id;
    const result = await db.collection('recipes').insertOne(remixedRecipe);
    // Add to activity feed
    await db.collection('user_activity').insertOne({
        userId,
        type: 'recipe_remix',
        originalRecipeId,
        newRecipeId: result.insertedId,
        createdAt: new Date()
    });
    res.status(201).json({
        success: true,
        recipeId: result.insertedId
    });
}));
// Export recipe as text
router.get('/:id/export-text', auth, asyncHandler(async (req, res) => {
    const db = await connectToDatabase();
    const recipeId = new ObjectId(req.params.id);
    const recipe = await db.collection('recipes').findOne({ _id: recipeId });
    if (!recipe) {
        return res.status(404).json({ message: 'Recipe not found' });
    }
    // Format recipe as text
    let text = `${recipe.name}\n\n`;
    text += `Servings: ${recipe.servings}\n`;
    text += `Preparation time: ${recipe.prepTime} minutes\n`;
    text += `Cooking time: ${recipe.cookTime} minutes\n\n`;
    text += 'Ingredients:\n';
    recipe.ingredients.forEach(ingredient => {
        text += `- ${ingredient.amount} ${ingredient.unit} ${ingredient.name}\n`;
    });
    text += '\nInstructions:\n';
    recipe.instructions.forEach((instruction, index) => {
        text += `${index + 1}. ${instruction.text}\n`;
    });
    if (recipe.notes) {
        text += `\nNotes:\n${recipe.notes}\n`;
    }
    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Disposition', `attachment; filename="${recipe.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.txt"`);
    res.send(text);
}));
// Report a recipe
router.post('/:id/report', auth, [
    check('reason').isIn(['inappropriate', 'copyright', 'spam', 'other']),
    check('description').optional().trim()
], asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    const db = await connectToDatabase();
    const userId = new ObjectId(req.user.id);
    const recipeId = new ObjectId(req.params.id);
    const report = {
        recipeId,
        userId,
        reason: req.body.reason,
        description: req.body.description,
        status: 'pending',
        createdAt: new Date()
    };
    await db.collection('recipe_reports').insertOne(report);
    res.json({ success: true });
}));
// Get recipe likes
router.get('/:id/likes', asyncHandler(async (req, res) => {
    const db = await connectToDatabase();
    const recipeId = new ObjectId(req.params.id);
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    const skip = (page - 1) * limit;
    const [likes, total] = await Promise.all([
        db.collection('recipe_likes')
            .aggregate([
            {
                $match: { recipeId }
            },
            {
                $lookup: {
                    from: 'users',
                    localField: 'userId',
                    foreignField: '_id',
                    as: 'user'
                }
            },
            {
                $unwind: '$user'
            },
            {
                $project: {
                    'user.password': 0,
                    'user.email': 0
                }
            },
            {
                $sort: { createdAt: -1 }
            },
            { $skip: skip },
            { $limit: limit }
        ])
            .toArray(),
        db.collection('recipe_likes').countDocuments({ recipeId })
    ]);
    res.json({
        likes,
        total,
        page,
        totalPages: Math.ceil(total / limit)
    });
}));
// Like/unlike a recipe
router.post('/:id/like', auth, asyncHandler(async (req, res) => {
    const db = await connectToDatabase();
    const userId = new ObjectId(req.user.id);
    const recipeId = new ObjectId(req.params.id);
    // Check if recipe exists
    const recipe = await db.collection('recipes').findOne({ _id: recipeId });
    if (!recipe) {
        return res.status(404).json({ message: 'Recipe not found' });
    }
    // Check if already liked
    const existingLike = await db.collection('recipe_likes').findOne({
        userId,
        recipeId
    });
    if (existingLike) {
        // Unlike
        await Promise.all([
            db.collection('recipe_likes').deleteOne({ _id: existingLike._id }),
            db.collection('recipes').updateOne({ _id: recipeId }, { $inc: { likes: -1 } })
        ]);
        res.json({ liked: false });
    }
    else {
        // Like
        const like = {
            userId,
            recipeId,
            createdAt: new Date()
        };
        await Promise.all([
            db.collection('recipe_likes').insertOne(like),
            db.collection('recipes').updateOne({ _id: recipeId }, { $inc: { likes: 1 } }),
            db.collection('user_activity').insertOne({
                userId,
                type: 'recipe_like',
                recipeId,
                createdAt: new Date()
            })
        ]);
        res.json({ liked: true });
    }
}));
// Get discover feed (popular, trending, recommended recipes)
router.get('/discover', asyncHandler(async (req, res) => {
    const db = await connectToDatabase();
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    const skip = (page - 1) * limit;
    const [popular, trending, recommended] = await Promise.all([
        // Popular recipes (most liked/saved)
        db.collection('recipes')
            .aggregate([
            {
                $lookup: {
                    from: 'recipe_interactions',
                    localField: '_id',
                    foreignField: 'recipeId',
                    as: 'interactions'
                }
            },
            {
                $addFields: {
                    interactionScore: {
                        $size: '$interactions'
                    }
                }
            },
            {
                $sort: { interactionScore: -1 }
            },
            {
                $limit: 10
            }
        ])
            .toArray(),
        // Trending recipes (recent interactions)
        db.collection('recipes')
            .aggregate([
            {
                $lookup: {
                    from: 'recipe_interactions',
                    let: { recipeId: '$_id' },
                    pipeline: [
                        {
                            $match: {
                                $expr: { $eq: ['$recipeId', '$$recipeId'] },
                                createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } // Last 7 days
                            }
                        }
                    ],
                    as: 'recentInteractions'
                }
            },
            {
                $addFields: {
                    trendScore: { $size: '$recentInteractions' }
                }
            },
            {
                $sort: { trendScore: -1 }
            },
            {
                $limit: 10
            }
        ])
            .toArray(),
        // Recommended recipes (personalized if user is logged in)
        db.collection('recipes')
            .aggregate([
            {
                $sample: { size: 10 } // For now, just random. TODO: implement proper recommendation system
            }
        ])
            .toArray()
    ]);
    res.json({
        popular,
        trending,
        recommended
    });
}));
// Get user's recipes
router.get('/user/:userId', asyncHandler(async (req, res) => {
    const db = await connectToDatabase();
    const userId = new ObjectId(req.params.userId);
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    const skip = (page - 1) * limit;
    const [recipes, total] = await Promise.all([
        db.collection('recipes')
            .aggregate([
            {
                $match: { userId }
            },
            {
                $lookup: {
                    from: 'users',
                    localField: 'userId',
                    foreignField: '_id',
                    as: 'user'
                }
            },
            {
                $unwind: '$user'
            },
            {
                $project: {
                    'user.password': 0,
                    'user.email': 0
                }
            },
            {
                $sort: { createdAt: -1 }
            },
            { $skip: skip },
            { $limit: limit }
        ])
            .toArray(),
        db.collection('recipes').countDocuments({ userId })
    ]);
    res.json({
        recipes,
        total,
        page,
        totalPages: Math.ceil(total / limit)
    });
}));
// Add recipe to cookbook
router.post('/:id/cookbook', auth, asyncHandler(async (req, res) => {
    const db = await connectToDatabase();
    const userId = new ObjectId(req.user.id);
    const recipeId = new ObjectId(req.params.id);
    // Verify recipe exists
    const recipe = await db.collection('recipes').findOne({ _id: recipeId });
    if (!recipe) {
        return res.status(404).json({ message: 'Recipe not found' });
    }
    // Check if already in cookbook
    const existing = await db.collection('cookbook_entries').findOne({
        userId,
        recipeId
    });
    if (existing) {
        return res.status(400).json({ message: 'Recipe already in cookbook' });
    }
    const entry = {
        userId,
        recipeId,
        createdAt: new Date()
    };
    await Promise.all([
        db.collection('cookbook_entries').insertOne(entry),
        db.collection('user_activity').insertOne({
            userId,
            type: 'cookbook_add',
            recipeId,
            createdAt: new Date()
        })
    ]);
    res.json({ success: true });
}));
// Remove recipe from cookbook
router.delete('/cookbook/:recipeId', auth, asyncHandler(async (req, res) => {
    const db = await connectToDatabase();
    const userId = new ObjectId(req.user.id);
    const recipeId = new ObjectId(req.params.recipeId);
    const result = await db.collection('cookbook_entries').deleteOne({
        userId,
        recipeId
    });
    if (result.deletedCount === 0) {
        return res.status(404).json({ message: 'Recipe not found in cookbook' });
    }
    res.json({ success: true });
}));
// Remix recipe
router.post('/:id/remix', auth, asyncHandler(async (req, res) => {
    const db = await connectToDatabase();
    const userId = new ObjectId(req.user.id);
    const originalRecipeId = new ObjectId(req.params.id);
    // Get original recipe
    const originalRecipe = await db.collection('recipes').findOne({ _id: originalRecipeId });
    if (!originalRecipe) {
        return res.status(404).json({ message: 'Recipe not found' });
    }
    // Create new recipe based on original
    const remixedRecipe = {
        ...originalRecipe,
        name: `${originalRecipe.name} (Remix)`,
        userId,
        remixedFrom: {
            recipeId: originalRecipeId,
            userId: originalRecipe.userId
        },
        createdAt: new Date(),
        updatedAt: new Date()
    };
    delete remixedRecipe._id;
    const result = await db.collection('recipes').insertOne(remixedRecipe);
    // Add to activity feed
    await db.collection('user_activity').insertOne({
        userId,
        type: 'recipe_remix',
        originalRecipeId,
        newRecipeId: result.insertedId,
        createdAt: new Date()
    });
    res.status(201).json({
        success: true,
        recipeId: result.insertedId
    });
}));
// Export recipe as text
router.get('/:id/export-text', auth, asyncHandler(async (req, res) => {
    const db = await connectToDatabase();
    const recipeId = new ObjectId(req.params.id);
    const recipe = await db.collection('recipes').findOne({ _id: recipeId });
    if (!recipe) {
        return res.status(404).json({ message: 'Recipe not found' });
    }
    // Format recipe as text
    let text = `${recipe.name}\n\n`;
    text += `Servings: ${recipe.servings}\n`;
    text += `Preparation time: ${recipe.prepTime} minutes\n`;
    text += `Cooking time: ${recipe.cookTime} minutes\n\n`;
    text += 'Ingredients:\n';
    recipe.ingredients.forEach(ingredient => {
        text += `- ${ingredient.amount} ${ingredient.unit} ${ingredient.name}\n`;
    });
    text += '\nInstructions:\n';
    recipe.instructions.forEach((instruction, index) => {
        text += `${index + 1}. ${instruction.text}\n`;
    });
    if (recipe.notes) {
        text += `\nNotes:\n${recipe.notes}\n`;
    }
    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Disposition', `attachment; filename="${recipe.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.txt"`);
    res.send(text);
}));
// Report recipe
router.post('/:id/report', auth, [
    check('reason').isIn(['inappropriate', 'copyright', 'spam', 'other']),
    check('description').trim().notEmpty()
], asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    const db = await connectToDatabase();
    const userId = new ObjectId(req.user.id);
    const recipeId = new ObjectId(req.params.id);
    const report = {
        userId,
        recipeId,
        reason: req.body.reason,
        description: req.body.description,
        status: 'pending',
        createdAt: new Date()
    };
    await db.collection('recipe_reports').insertOne(report);
    res.json({ success: true });
}));
// Get recipe likes
router.get('/:id/likes', asyncHandler(async (req, res) => {
    const db = await connectToDatabase();
    const recipeId = new ObjectId(req.params.id);
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    const skip = (page - 1) * limit;
    const [likes, total] = await Promise.all([
        db.collection('recipe_likes')
            .aggregate([
            {
                $match: { recipeId }
            },
            {
                $lookup: {
                    from: 'users',
                    localField: 'userId',
                    foreignField: '_id',
                    as: 'user'
                }
            },
            {
                $unwind: '$user'
            },
            {
                $project: {
                    'user.password': 0,
                    'user.email': 0
                }
            },
            {
                $sort: { createdAt: -1 }
            },
            { $skip: skip },
            { $limit: limit }
        ])
            .toArray(),
        db.collection('recipe_likes').countDocuments({ recipeId })
    ]);
    res.json({
        likes,
        total,
        page,
        totalPages: Math.ceil(total / limit)
    });
}));
// Like/unlike recipe
router.post('/:id/like', auth, asyncHandler(async (req, res) => {
    const db = await connectToDatabase();
    const userId = new ObjectId(req.user.id);
    const recipeId = new ObjectId(req.params.id);
    // Check if recipe exists
    const recipe = await db.collection('recipes').findOne({ _id: recipeId });
    if (!recipe) {
        return res.status(404).json({ message: 'Recipe not found' });
    }
    // Check if already liked
    const existingLike = await db.collection('recipe_likes').findOne({
        userId,
        recipeId
    });
    if (existingLike) {
        // Unlike
        await Promise.all([
            db.collection('recipe_likes').deleteOne({ _id: existingLike._id }),
            db.collection('recipes').updateOne({ _id: recipeId }, { $inc: { likes: -1 } })
        ]);
        res.json({ liked: false });
    }
    else {
        // Like
        const like = {
            userId,
            recipeId,
            createdAt: new Date()
        };
        await Promise.all([
            db.collection('recipe_likes').insertOne(like),
            db.collection('recipes').updateOne({ _id: recipeId }, { $inc: { likes: 1 } }),
            db.collection('user_activity').insertOne({
                userId,
                type: 'recipe_like',
                recipeId,
                createdAt: new Date()
            })
        ]);
        res.json({ liked: true });
    }
}));
// Get user's cookbook
router.get('/cookbook', auth, asyncHandler(async (req, res) => {
    const db = await connectToDatabase();
    const userId = new ObjectId(req.user.id);
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    const skip = (page - 1) * limit;
    const [entries, total] = await Promise.all([
        db.collection('cookbook_entries')
            .aggregate([
            {
                $match: { userId }
            },
            {
                $lookup: {
                    from: 'recipes',
                    localField: 'recipeId',
                    foreignField: '_id',
                    as: 'recipe'
                }
            },
            {
                $unwind: '$recipe'
            },
            {
                $lookup: {
                    from: 'users',
                    localField: 'recipe.userId',
                    foreignField: '_id',
                    as: 'recipe.user'
                }
            },
            {
                $unwind: '$recipe.user'
            },
            {
                $project: {
                    'recipe.user.password': 0,
                    'recipe.user.email': 0
                }
            },
            {
                $sort: { createdAt: -1 }
            },
            { $skip: skip },
            { $limit: limit }
        ])
            .toArray(),
        db.collection('cookbook_entries').countDocuments({ userId })
    ]);
    res.json({
        entries,
        total,
        page,
        totalPages: Math.ceil(total / limit)
    });
}));
// Remove recipe from cookbook
router.delete('/cookbook/:recipeId', auth, asyncHandler(async (req, res) => {
    const db = await connectToDatabase();
    const userId = new ObjectId(req.user.id);
    const recipeId = new ObjectId(req.params.recipeId);
    const result = await db.collection('cookbook_entries').deleteOne({
        userId,
        recipeId
    });
    if (result.deletedCount === 0) {
        return res.status(404).json({ message: 'Recipe not found in cookbook' });
    }
    res.json({ success: true });
}));
export default router;
//# sourceMappingURL=recipes.js.map
export class DiscoverService {
    constructor(recipesCollection) {
        this.recipesCollection = recipesCollection;
    }
    async getPopularRecipes(options = {}) {
        const { userId, category, cuisine, difficulty, maxPrepTime, isPro, page = 1, limit = 20, } = options;
        const filter = {
            isPrivate: false,
        };
        if (category) {
            filter.categories = category;
        }
        if (cuisine) {
            filter.cuisine = cuisine;
        }
        if (difficulty) {
            filter.difficulty = difficulty;
        }
        if (maxPrepTime) {
            filter.prepTime = { $lte: maxPrepTime };
        }
        if (typeof isPro === 'boolean') {
            filter.isPro = isPro;
        }
        if (userId) {
            filter.userId = { $ne: userId }; // Exclude user's own recipes
        }
        const skip = (page - 1) * limit;
        const [recipes, total] = await Promise.all([
            this.recipesCollection
                .find(filter)
                .sort({ likes: -1, rating: -1 })
                .skip(skip)
                .limit(limit)
                .toArray(),
            this.recipesCollection.countDocuments(filter),
        ]);
        return { recipes: recipes, total };
    }
    async getRecentRecipes(options = {}) {
        const { userId, category, cuisine, difficulty, maxPrepTime, isPro, page = 1, limit = 20, } = options;
        const filter = {
            isPrivate: false,
        };
        if (category) {
            filter.categories = category;
        }
        if (cuisine) {
            filter.cuisine = cuisine;
        }
        if (difficulty) {
            filter.difficulty = difficulty;
        }
        if (maxPrepTime) {
            filter.prepTime = { $lte: maxPrepTime };
        }
        if (typeof isPro === 'boolean') {
            filter.isPro = isPro;
        }
        if (userId) {
            filter.userId = { $ne: userId }; // Exclude user's own recipes
        }
        const skip = (page - 1) * limit;
        const [recipes, total] = await Promise.all([
            this.recipesCollection.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).toArray(),
            this.recipesCollection.countDocuments(filter),
        ]);
        return { recipes: recipes, total };
    }
    async getTrendingRecipes(options = {}) {
        const { userId, category, cuisine, difficulty, maxPrepTime, isPro, page = 1, limit = 20, } = options;
        const filter = {
            isPrivate: false,
        };
        if (category) {
            filter.categories = category;
        }
        if (cuisine) {
            filter.cuisine = cuisine;
        }
        if (difficulty) {
            filter.difficulty = difficulty;
        }
        if (maxPrepTime) {
            filter.prepTime = { $lte: maxPrepTime };
        }
        if (typeof isPro === 'boolean') {
            filter.isPro = isPro;
        }
        if (userId) {
            filter.userId = { $ne: userId }; // Exclude user's own recipes
        }
        // Calculate trending score based on recent likes and shares
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
        const pipeline = [
            { $match: filter },
            {
                $addFields: {
                    trendingScore: {
                        $add: [
                            { $multiply: [{ $ifNull: ['$likes', 0] }, 1] }, // Weight for likes
                            { $multiply: [{ $ifNull: ['$shares', 0] }, 2] }, // Weight for shares
                            {
                                $multiply: [
                                    {
                                        $cond: [
                                            { $gte: ['$createdAt', oneWeekAgo] },
                                            10, // Boost for recent recipes
                                            0,
                                        ],
                                    },
                                    1,
                                ],
                            },
                        ],
                    },
                },
            },
            { $sort: { trendingScore: -1 } },
            { $skip: (page - 1) * limit },
            { $limit: limit },
        ];
        const [recipes, countResult] = await Promise.all([
            this.recipesCollection.aggregate(pipeline).toArray(),
            this.recipesCollection.aggregate([{ $match: filter }, { $count: 'total' }]).toArray(),
        ]);
        const total = countResult[0]?.total || 0;
        return { recipes: recipes, total };
    }
    async getRecommendedRecipes(userId, options = {}) {
        const { category, cuisine, difficulty, maxPrepTime, isPro, page = 1, limit = 20 } = options;
        // Get user's favorite recipes
        const favorites = await this.recipesCollection
            .find({
            userId,
            isPrivate: false,
        })
            .toArray();
        // Extract common categories and cuisines
        const userCategories = new Set();
        const userCuisines = new Set();
        favorites.forEach(recipe => {
            recipe.categories?.forEach(cat => userCategories.add(cat));
            if (recipe.cuisine) {
                userCuisines.add(recipe.cuisine);
            }
        });
        // Build recommendation filter
        const filter = {
            isPrivate: false,
            userId: { $ne: userId }, // Exclude user's own recipes
            $or: [
                { categories: { $in: Array.from(userCategories) } },
                { cuisine: { $in: Array.from(userCuisines) } },
            ],
        };
        if (category) {
            filter.categories = category;
        }
        if (cuisine) {
            filter.cuisine = cuisine;
        }
        if (difficulty) {
            filter.difficulty = difficulty;
        }
        if (maxPrepTime) {
            filter.prepTime = { $lte: maxPrepTime };
        }
        if (typeof isPro === 'boolean') {
            filter.isPro = isPro;
        }
        const skip = (page - 1) * limit;
        const [recipes, total] = await Promise.all([
            this.recipesCollection
                .find(filter)
                .sort({ likes: -1, rating: -1 })
                .skip(skip)
                .limit(limit)
                .toArray(),
            this.recipesCollection.countDocuments(filter),
        ]);
        return { recipes: recipes, total };
    }
    async getPopularCategories() {
        const categories = await this.recipesCollection
            .aggregate([
            { $match: { isPrivate: false } },
            { $unwind: '$categories' },
            {
                $group: {
                    _id: '$categories',
                    count: { $sum: 1 },
                },
            },
            { $sort: { count: -1 } },
            { $limit: 10 },
        ])
            .toArray();
        return categories.map(cat => ({
            name: cat._id,
            count: cat.count,
        }));
    }
    async getPopularCuisines() {
        const cuisines = await this.recipesCollection
            .aggregate([
            { $match: { isPrivate: false, cuisine: { $exists: true } } },
            {
                $group: {
                    _id: '$cuisine',
                    count: { $sum: 1 },
                },
            },
            { $sort: { count: -1 } },
            { $limit: 10 },
        ])
            .toArray();
        return cuisines.map(cuisine => ({
            name: cuisine._id,
            count: cuisine.count,
        }));
    }
}
//# sourceMappingURL=discover.js.map
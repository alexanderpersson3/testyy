export class FavoritesService {
    constructor(favoritesCollection, recipesCollection) {
        this.favoritesCollection = favoritesCollection;
        this.recipesCollection = recipesCollection;
    }
    async addFavorite(userId, itemId, itemType) {
        // Check if already favorited
        const existing = await this.favoritesCollection.findOne({
            userId,
            itemId,
            itemType,
        });
        if (existing) {
            return;
        }
        // Add to favorites
        await this.favoritesCollection.insertOne({
            userId,
            itemId,
            itemType,
            createdAt: new Date(),
        });
        // If it's a recipe, increment the likes count
        if (itemType === 'recipe') {
            await this.recipesCollection.updateOne({ _id: itemId }, { $inc: { likes: 1 } });
        }
    }
    async removeFavorite(userId, itemId, itemType) {
        const result = await this.favoritesCollection.deleteOne({
            userId,
            itemId,
            itemType,
        });
        // If it's a recipe and we actually removed a favorite, decrement the likes count
        if (itemType === 'recipe' && result.deletedCount > 0) {
            await this.recipesCollection.updateOne({ _id: itemId }, { $inc: { likes: -1 } });
        }
    }
    async getFavorites(userId, itemType) {
        const query = { userId };
        if (itemType) {
            query.itemType = itemType;
        }
        return this.favoritesCollection.find(query).sort({ createdAt: -1 }).toArray();
    }
    async getFavoriteRecipes(userId, page = 1, limit = 20) {
        const skip = (page - 1) * limit;
        // Get favorite recipe IDs
        const favorites = await this.favoritesCollection
            .find({
            userId,
            itemType: 'recipe',
        })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .toArray();
        const recipeIds = favorites.map(f => f.itemId);
        // Get the actual recipes
        const [recipes, total] = await Promise.all([
            this.recipesCollection.find({ _id: { $in: recipeIds } }).toArray(),
            this.favoritesCollection.countDocuments({
                userId,
                itemType: 'recipe',
            }),
        ]);
        // Sort recipes in the same order as favorites
        const recipeMap = new Map(recipes.map(r => [r._id.toString(), r]));
        const sortedRecipes = recipeIds
            .map(id => recipeMap.get(id.toString()))
            .filter((r) => r !== undefined);
        return { recipes: sortedRecipes, total };
    }
    async isFavorite(userId, itemId, itemType) {
        const favorite = await this.favoritesCollection.findOne({
            userId,
            itemId,
            itemType,
        });
        return favorite !== null;
    }
    async getPopularRecipes(limit = 10) {
        return this.recipesCollection
            .find({
            isPrivate: false,
            isPro: false,
        })
            .sort({ likes: -1 })
            .limit(limit)
            .toArray();
    }
}
//# sourceMappingURL=favorites.js.map
import { Collection, ObjectId } from 'mongodb';
import { Recipe } from '../types/recipe.js';

export interface FavoriteItem {
  _id?: ObjectId;
  userId: ObjectId;
  itemId: ObjectId;
  itemType: 'recipe' | 'ingredient';
  createdAt: Date;
}

export class FavoritesService {
  constructor(
    private favoritesCollection: Collection<FavoriteItem>,
    private recipesCollection: Collection<Recipe>
  ) {}

  async addFavorite(userId: ObjectId, itemId: ObjectId, itemType: 'recipe' | 'ingredient'): Promise<void> {
    // Check if already favorited
    const existing = await this.favoritesCollection.findOne({
      userId,
      itemId,
      itemType
    });

    if (existing) {
      return;
    }

    // Add to favorites
    await this.favoritesCollection.insertOne({
      userId,
      itemId,
      itemType,
      createdAt: new Date()
    });

    // If it's a recipe, increment the likes count
    if (itemType === 'recipe') {
      await this.recipesCollection.updateOne(
        { _id: itemId },
        { $inc: { likes: 1 } }
      );
    }
  }

  async removeFavorite(userId: ObjectId, itemId: ObjectId, itemType: 'recipe' | 'ingredient'): Promise<void> {
    const result = await this.favoritesCollection.deleteOne({
      userId,
      itemId,
      itemType
    });

    // If it's a recipe and we actually removed a favorite, decrement the likes count
    if (itemType === 'recipe' && result.deletedCount > 0) {
      await this.recipesCollection.updateOne(
        { _id: itemId },
        { $inc: { likes: -1 } }
      );
    }
  }

  async getFavorites(userId: ObjectId, itemType?: 'recipe' | 'ingredient'): Promise<FavoriteItem[]> {
    const query: any = { userId };
    if (itemType) {
      query.itemType = itemType;
    }

    return this.favoritesCollection
      .find(query)
      .sort({ createdAt: -1 })
      .toArray();
  }

  async getFavoriteRecipes(userId: ObjectId, page = 1, limit = 20): Promise<{ recipes: Recipe[]; total: number }> {
    const skip = (page - 1) * limit;

    // Get favorite recipe IDs
    const favorites = await this.favoritesCollection
      .find({
        userId,
        itemType: 'recipe'
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    const recipeIds = favorites.map(f => f.itemId);

    // Get the actual recipes
    const [recipes, total] = await Promise.all([
      this.recipesCollection
        .find({ _id: { $in: recipeIds } })
        .toArray(),
      this.favoritesCollection.countDocuments({
        userId,
        itemType: 'recipe'
      })
    ]);

    // Sort recipes in the same order as favorites
    const recipeMap = new Map(recipes.map(r => [r._id!.toString(), r]));
    const sortedRecipes = recipeIds
      .map(id => recipeMap.get(id.toString()))
      .filter((r): r is NonNullable<typeof r> => r !== undefined);

    return { recipes: sortedRecipes, total };
  }

  async isFavorite(userId: ObjectId, itemId: ObjectId, itemType: 'recipe' | 'ingredient'): Promise<boolean> {
    const favorite = await this.favoritesCollection.findOne({
      userId,
      itemId,
      itemType
    });

    return favorite !== null;
  }

  async getPopularRecipes(limit = 10): Promise<Recipe[]> {
    return this.recipesCollection
      .find({
        isPrivate: false,
        isPro: false
      })
      .sort({ likes: -1 })
      .limit(limit)
      .toArray();
  }
} 

;
;
import type { Collection } from 'mongodb';
import type { ObjectId } from '../types/express.js';
import { DatabaseService } from '../db/database.service.js';;
import logger from '../utils/logger.js';
import { DatabaseError, NotFoundError } from '../utils/errors.js';;
import type { Recipe } from '../types/express.js';
import { ShoppingList, ShoppingListItem } from '../types/shopping-list.js';;
import { IngredientWithPrices, IngredientSource } from '../types/ingredient.js';;

interface Favorite {
  _id: ObjectId;
  userId: ObjectId;
  itemId: ObjectId;
  itemType: 'recipe' | 'ingredient';
  customName?: string;
  defaultQuantity?: number;
  defaultUnit?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

type CreateFavoriteDTO = Omit<Favorite, '_id'>;
type UpdateFavoriteDTO = Partial<Pick<Favorite, 'customName' | 'defaultQuantity' | 'defaultUnit' | 'notes'>>;

export class FavoritesService {
  private static instance: FavoritesService;
  private db: DatabaseService;
  private initialized: boolean = false;
  private favoritesCollection!: Collection<Favorite>;
  private recipesCollection!: Collection<Recipe>;
  private shoppingListsCollection!: Collection<ShoppingList>;
  private ingredientsCollection!: Collection<IngredientWithPrices>;

  private constructor() {
    this.db = DatabaseService.getInstance();
    this.initialize().catch(error => {
      logger.error('Failed to initialize FavoritesService:', error);
    });
  }

  private async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      await this.db.connect();
      this.favoritesCollection = this.db.getCollection<Favorite>('favorites');
      this.recipesCollection = this.db.getCollection<Recipe>('recipes');
      this.shoppingListsCollection = this.db.getCollection<ShoppingList>('shopping_lists');
      this.ingredientsCollection = this.db.getCollection<IngredientWithPrices>('ingredients');
      this.initialized = true;
      logger.info('FavoritesService initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize FavoritesService:', error);
      throw error;
    }
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  public static getInstance(): FavoritesService {
    if (!FavoritesService.instance) {
      FavoritesService.instance = new FavoritesService();
    }
    return FavoritesService.instance;
  }

  /**
   * Add item to favorites
   */
  async addFavorite(
    userId: ObjectId,
    itemId: ObjectId,
    itemType: 'recipe' | 'ingredient'
  ): Promise<void> {
    await this.ensureInitialized();

    try {
      const existingFavorite = await this.favoritesCollection.findOne({
        userId,
        itemId,
        itemType,
      });

      if (existingFavorite) {
        throw new Error('Item already in favorites');
      }

      const favorite: CreateFavoriteDTO = {
        userId,
        itemId,
        itemType,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await this.favoritesCollection.insertOne(favorite as Favorite);
    } catch (error) {
      logger.error('Failed to add favorite:', error);
      throw new DatabaseError('Failed to add favorite');
    }
  }

  /**
   * Remove item from favorites
   */
  async removeFavorite(
    userId: ObjectId,
    itemId: ObjectId,
    itemType: 'recipe' | 'ingredient'
  ): Promise<void> {
    await this.ensureInitialized();

    try {
      const result = await this.favoritesCollection.deleteOne({
        userId,
        itemId,
        itemType,
      });

      if (result.deletedCount === 0) {
        throw new NotFoundError('Favorite not found');
      }
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      logger.error('Failed to remove favorite:', error);
      throw new DatabaseError('Failed to remove favorite');
    }
  }

  /**
   * Get user's favorites
   */
  async getFavorites(
    userId: ObjectId,
    itemType?: 'recipe' | 'ingredient'
  ): Promise<Favorite[]> {
    await this.ensureInitialized();

    try {
      const query: { userId: ObjectId; itemType?: 'recipe' | 'ingredient' } = { userId };
      if (itemType) {
        query.itemType = itemType;
      }

      return this.favoritesCollection
        .find(query)
        .sort({ createdAt: -1 })
        .toArray();
    } catch (error) {
      logger.error('Failed to get favorites:', error);
      throw new DatabaseError('Failed to get favorites');
    }
  }

  /**
   * Get favorite recipes with details
   */
  async getFavoriteRecipes(
    userId: ObjectId,
    page: number = 1,
    limit: number = 20
  ): Promise<{
    recipes: Recipe[];
    total: number;
  }> {
    await this.ensureInitialized();

    try {
      const skip = (page - 1) * limit;

      const [recipes, total] = await Promise.all([
        this.favoritesCollection
          .aggregate<Recipe>([
            {
              $match: {
                userId,
                itemType: 'recipe',
              },
            },
            {
              $lookup: {
                from: 'recipes',
                localField: 'itemId',
                foreignField: '_id',
                as: 'recipe',
              },
            },
            { $unwind: '$recipe' },
            { $replaceRoot: { newRoot: '$recipe' } },
            { $skip: skip },
            { $limit: limit },
          ])
          .toArray(),
        this.favoritesCollection.countDocuments({
          userId,
          itemType: 'recipe',
        }),
      ]);

      return { recipes, total };
    } catch (error) {
      logger.error('Failed to get favorite recipes:', error);
      throw new DatabaseError('Failed to get favorite recipes');
    }
  }

  /**
   * Check if item is favorited
   */
  async isFavorite(
    userId: ObjectId,
    itemId: ObjectId,
    itemType: 'recipe' | 'ingredient'
  ): Promise<boolean> {
    await this.ensureInitialized();

    try {
      const favorite = await this.favoritesCollection.findOne({
        userId,
        itemId,
        itemType,
      });

      return !!favorite;
    } catch (error) {
      logger.error('Failed to check favorite status:', error);
      throw new DatabaseError('Failed to check favorite status');
    }
  }

  /**
   * Get popular recipes
   */
  async getPopularRecipes(limit: number = 10): Promise<Recipe[]> {
    await this.ensureInitialized();

    try {
      const popularRecipes = await this.favoritesCollection
        .aggregate<Recipe>([
          { $match: { itemType: 'recipe' } },
          {
            $group: {
              _id: '$itemId',
              count: { $sum: 1 },
            },
          },
          { $sort: { count: -1 } },
          { $limit: limit },
          {
            $lookup: {
              from: 'recipes',
              localField: '_id',
              foreignField: '_id',
              as: 'recipe',
            },
          },
          { $unwind: '$recipe' },
          { $replaceRoot: { newRoot: '$recipe' } },
        ])
        .toArray();

      return popularRecipes;
    } catch (error) {
      logger.error('Failed to get popular recipes:', error);
      throw new DatabaseError('Failed to get popular recipes');
    }
  }

  /**
   * Update favorite item
   */
  async updateFavorite(
    favoriteId: ObjectId,
    userId: ObjectId,
    updates: UpdateFavoriteDTO
  ): Promise<boolean> {
    await this.ensureInitialized();

    try {
      const result = await this.favoritesCollection.updateOne(
        {
          _id: favoriteId,
          userId,
        },
        {
          $set: {
            ...updates,
            updatedAt: new Date(),
          },
        }
      );

      if (result.matchedCount === 0) {
        throw new NotFoundError('Favorite item not found');
      }

      return true;
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      logger.error('Failed to update favorite:', error);
      throw new DatabaseError('Failed to update favorite');
    }
  }

  /**
   * Add favorite item to shopping list
   */
  async addFavoriteToShoppingList(
    userId: ObjectId,
    favoriteId: ObjectId,
    listId: ObjectId
  ): Promise<ShoppingListItem> {
    await this.ensureInitialized();

    try {
      // Get favorite item
      const favorite = await this.favoritesCollection.findOne({
        _id: favoriteId,
        userId,
      });

      if (!favorite) {
        throw new NotFoundError('Favorite item not found');
      }

      // Get ingredient details
      const ingredient = await this.ingredientsCollection.findOne({
        _id: favorite.itemId,
      });

      if (!ingredient) {
        throw new NotFoundError('Ingredient not found');
      }

      // Verify shopping list ownership
      const list = await this.shoppingListsCollection.findOne({
        _id: listId,
        owner: userId,
      });

      if (!list) {
        throw new NotFoundError('Shopping list not found');
      }

      // Create shopping list item
      const shoppingItem: ShoppingListItem = {
        _id: new ObjectId(),
        ingredient: {
          _id: ingredient._id!,
          name: favorite.customName || ingredient.name,
          description: ingredient.description,
          category: ingredient.category,
          tags: ingredient.tags,
          source: ingredient.source,
          isVerified: ingredient.isVerified,
          status: ingredient.status,
          prices: ingredient.prices || [],
          createdAt: ingredient.createdAt,
          updatedAt: ingredient.updatedAt
        },
        quantity: favorite.defaultQuantity || 1,
        unit: favorite.defaultUnit || 'st',
        checked: false,
        addedBy: userId,
        addedAt: new Date(),
      };

      // Add to shopping list
      await this.shoppingListsCollection.updateOne(
        { _id: listId },
        {
          $push: { items: shoppingItem },
          $set: { updatedAt: new Date() },
        }
      );

      return shoppingItem;
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      logger.error('Failed to add favorite to shopping list:', error);
      throw new DatabaseError('Failed to add favorite to shopping list');
    }
  }
} 
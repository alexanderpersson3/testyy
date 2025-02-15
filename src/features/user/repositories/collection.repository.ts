import { ObjectId } from 'mongodb';
import type { Filter, Sort, UpdateFilter } from 'mongodb';
import { BaseRepository } from '../db/base.repository.js';
import type { MongoDocument } from '../types/mongodb.types.js';

/**
 * Collection document with MongoDB fields
 */
export interface CollectionDocument {
  _id: ObjectId;
  name: string;
  description?: string;
  owner: {
    _id: ObjectId;
    name: string;
  };
  recipes: Array<{
    _id: ObjectId;
    title: string;
    addedAt: Date;
    order: number;
  }>;
  collaborators: Array<{
    userId: ObjectId;
    role: 'editor' | 'viewer';
    addedAt: Date;
  }>;
  privacy: 'private' | 'public' | 'shared';
  tags: string[];
  stats: {
    recipeCount: number;
    totalCookTime: number;
    averageDifficulty: number;
    cuisineDistribution: Record<string, number>;
    lastUpdated: Date;
  };
  settings: {
    allowComments: boolean;
    showIngredients: boolean;
    showNutrition: boolean;
    defaultSort: 'manual' | 'date' | 'title' | 'popularity';
  };
  lastActivityAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Collection search parameters
 */
export interface CollectionSearchParams {
  query?: string;
  tags?: string[];
  privacy?: 'private' | 'public' | 'shared';
  hasRecipe?: ObjectId;
  minRecipes?: number;
  maxRecipes?: number;
  rating?: number;
  updatedSince?: Date;
  sortBy?: 'name' | 'created' | 'updated' | 'popularity';
  sortDirection?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

/**
 * Repository for managing recipe collections in MongoDB
 */
export class CollectionRepository extends BaseRepository<CollectionDocument> {
  constructor() {
    super('collections');
  }

  /**
   * Find collections by search parameters
   */
  async search(params: CollectionSearchParams): Promise<CollectionDocument[]> {
    const query: any = {};

    if (params.query) {
      query.$or = [
        { name: { $regex: params.query, $options: 'i' } },
        { description: { $regex: params.query, $options: 'i' } },
        { tags: { $regex: params.query, $options: 'i' } }
      ];
    }

    if (params.tags?.length) {
      query.tags = { $all: params.tags };
    }

    if (params.privacy) {
      query.privacy = params.privacy;
    }

    if (params.hasRecipe) {
      query['recipes.recipeId'] = params.hasRecipe;
    }

    if (params.minRecipes !== undefined) {
      query['stats.recipeCount'] = { $gte: params.minRecipes };
    }

    if (params.maxRecipes !== undefined) {
      query['stats.recipeCount'] = {
        ...query['stats.recipeCount'],
        $lte: params.maxRecipes
      };
    }

    if (params.rating !== undefined) {
      query['stats.averageDifficulty'] = { $gte: params.rating };
    }

    if (params.updatedSince) {
      query.updatedAt = { $gte: params.updatedSince };
    }

    const sort: any = {};
    if (params.sortBy) {
      const sortField = params.sortBy === 'popularity'
        ? 'stats.recipeCount'
        : params.sortBy === 'created'
          ? 'createdAt'
          : params.sortBy === 'updated'
            ? 'updatedAt'
            : 'name';
      sort[sortField] = params.sortDirection === 'desc' ? -1 : 1;
    } else {
      sort.lastActivityAt = -1;
    }

    const options = {
      sort,
      skip: params.offset || 0,
      limit: params.limit || 50
    };

    return this.collection.find(query, options).toArray();
  }

  /**
   * Find collections by owner ID
   */
  async findByOwner(ownerId: ObjectId): Promise<CollectionDocument[]> {
    return this.collection.find({
      'owner._id': ownerId
    }).sort({ lastActivityAt: -1 }).toArray();
  }

  /**
   * Find collections by collaborator ID
   */
  async findByCollaborator(userId: ObjectId): Promise<CollectionDocument[]> {
    return this.collection.find({
      'collaborators.userId': userId
    }).sort({ lastActivityAt: -1 }).toArray();
  }

  /**
   * Add recipe to collection
   */
  async addRecipe(
    collectionId: ObjectId,
    recipeId: ObjectId,
    recipeTitle: string
  ): Promise<CollectionDocument | null> {
    const collection = await this.findById(collectionId);
    if (!collection) return null;

    const maxOrder = collection.recipes.reduce(
      (max, recipe) => Math.max(max, recipe.order),
      -1
    );

    const update: UpdateFilter<CollectionDocument> = {
      $push: {
        recipes: {
          _id: recipeId,
          title: recipeTitle,
          addedAt: new Date(),
          order: maxOrder + 1
        }
      },
      $set: {
        lastActivityAt: new Date(),
        'stats.recipeCount': collection.recipes.length + 1
      }
    };

    const result = await this.collection.findOneAndUpdate(
      { _id: collectionId },
      update,
      { returnDocument: 'after' }
    );

    return result.value;
  }

  /**
   * Remove recipe from collection
   */
  async removeRecipe(
    collectionId: ObjectId,
    recipeId: ObjectId
  ): Promise<CollectionDocument | null> {
    const collection = await this.findById(collectionId);
    if (!collection) return null;

    const update: UpdateFilter<CollectionDocument> = {
      $pull: {
        recipes: { _id: recipeId }
      },
      $set: {
        lastActivityAt: new Date(),
        'stats.recipeCount': collection.recipes.length - 1
      }
    };

    const result = await this.collection.findOneAndUpdate(
      { _id: collectionId },
      update,
      { returnDocument: 'after' }
    );

    return result.value;
  }

  /**
   * Update recipe order in collection
   */
  async updateRecipeOrder(
    collectionId: ObjectId,
    recipeId: ObjectId,
    newOrder: number
  ): Promise<CollectionDocument | null> {
    const update: UpdateFilter<CollectionDocument> = {
      $set: {
        'recipes.$[recipe].order': newOrder,
        lastActivityAt: new Date()
      }
    };

    const result = await this.collection.findOneAndUpdate(
      { _id: collectionId },
      update,
      {
        arrayFilters: [{ 'recipe._id': recipeId }],
        returnDocument: 'after'
      }
    );

    return result.value;
  }

  /**
   * Add collaborator to collection
   */
  async addCollaborator(
    collectionId: ObjectId,
    userId: ObjectId,
    role: 'editor' | 'viewer'
  ): Promise<CollectionDocument | null> {
    const update: UpdateFilter<CollectionDocument> = {
      $push: {
        collaborators: {
          userId,
          role,
          addedAt: new Date()
        }
      },
      $set: {
        lastActivityAt: new Date()
      }
    };

    const result = await this.collection.findOneAndUpdate(
      { _id: collectionId },
      update,
      { returnDocument: 'after' }
    );

    return result.value;
  }

  /**
   * Remove collaborator from collection
   */
  async removeCollaborator(
    collectionId: ObjectId,
    userId: ObjectId
  ): Promise<CollectionDocument | null> {
    const update: UpdateFilter<CollectionDocument> = {
      $pull: {
        collaborators: { userId }
      },
      $set: {
        lastActivityAt: new Date()
      }
    };

    const result = await this.collection.findOneAndUpdate(
      { _id: collectionId },
      update,
      { returnDocument: 'after' }
    );

    return result.value;
  }

  /**
   * Update collection stats
   */
  async updateStats(
    collectionId: ObjectId,
    stats: Partial<CollectionDocument['stats']>
  ): Promise<CollectionDocument | null> {
    const now = new Date();
    const result = await this.collection.findOneAndUpdate(
      { _id: collectionId },
      {
        $set: {
          ...Object.entries(stats).reduce((acc, [key, value]) => ({
            ...acc,
            [`stats.${key}`]: value
          }), {}),
          'stats.lastUpdated': now,
          lastActivityAt: now,
          updatedAt: now
        }
      },
      { returnDocument: 'after' }
    );

    return result.value;
  }

  /**
   * Get collection stats
   */
  async getStats(): Promise<{
    total: number;
    public: number;
    private: number;
    shared: number;
    avgRecipesPerCollection: number;
    topCuisines: Array<{ cuisine: string; count: number }>;
  }> {
    const pipeline = [
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          public: {
            $sum: { $cond: [{ $eq: ['$privacy', 'public'] }, 1, 0] }
          },
          private: {
            $sum: { $cond: [{ $eq: ['$privacy', 'private'] }, 1, 0] }
          },
          shared: {
            $sum: { $cond: [{ $eq: ['$privacy', 'shared'] }, 1, 0] }
          },
          totalRecipes: { $sum: '$stats.recipeCount' },
          cuisines: {
            $push: {
              k: { $objectToArray: '$stats.cuisineDistribution' },
              v: { $sum: 1 }
            }
          }
        }
      },
      {
        $project: {
          _id: 0,
          total: 1,
          public: 1,
          private: 1,
          shared: 1,
          avgRecipesPerCollection: {
            $cond: [
              { $eq: ['$total', 0] },
              0,
              { $divide: ['$totalRecipes', '$total'] }
            ]
          },
          topCuisines: {
            $slice: [
              {
                $sortArray: {
                  input: {
                    $map: {
                      input: '$cuisines',
                      as: 'cuisine',
                      in: {
                        cuisine: '$$cuisine.k',
                        count: '$$cuisine.v'
                      }
                    }
                  },
                  sortBy: { count: -1 }
                }
              },
              5
            ]
          }
        }
      }
    ];

    const [stats] = await this.collection
      .aggregate<{
        total: number;
        public: number;
        private: number;
        shared: number;
        avgRecipesPerCollection: number;
        topCuisines: Array<{ cuisine: string; count: number }>;
      }>(pipeline)
      .toArray();

    return stats || {
      total: 0,
      public: 0,
      private: 0,
      shared: 0,
      avgRecipesPerCollection: 0,
      topCuisines: []
    };
  }
} 
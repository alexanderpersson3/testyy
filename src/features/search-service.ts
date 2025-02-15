import { Db, ObjectId } from 'mongodb';
import { db } from '../db';

interface RecipeFilters {
  dietary?: string[];
  cuisine?: string[];
  difficulty?: string[];
  cookingTime?: { min?: number; max?: number };
  ingredients?: string[];
}

interface UserFilters {
    role?: string;
    subscription_tier?: string;
}

interface Pagination {
    total: number;
    page: number;
    limit: number;
    pages: number;
}
  
interface RecipeSearchResult {
    recipes: any[]; // Replace 'any' with a proper Recipe interface
    pagination: Pagination;
}
  
interface UserSearchResult {
    users: any[]; // Replace 'any' with a proper User interface
    pagination: Pagination;
}

interface CollectionSearchResult {
    collections: any[];
    pagination: Pagination;
}

class SearchService {
  private readonly SEARCH_TYPES = {
    RECIPE: 'recipe',
    USER: 'user',
    COLLECTION: 'collection',
  };

  private readonly SORT_OPTIONS = {
    RELEVANCE: 'relevance',
    DATE: 'date',
    RATING: 'rating',
    COOKING_TIME: 'cooking_time',
    DIFFICULTY: 'difficulty',
  };

  async searchRecipes(query: string, filters: RecipeFilters = {}, sort: string = 'relevance', page: number = 1, limit: number = 10): Promise<RecipeSearchResult> {
    const skip = (page - 1) * limit;

    // Build search pipeline
    const pipeline: object[] = [];

    // Text search stage
    if (query) {
      pipeline.push({
        $search: {
          index: 'recipes_search',
          compound: {
            should: [
              {
                text: {
                  query: query,
                  path: ['title', 'description'],
                  fuzzy: {
                    maxEdits: 1,
                    prefixLength: 3,
                  },
                  score: { boost: { value: 3 } },
                },
              },
              {
                text: {
                  query: query,
                  path: ['ingredients.name', 'tags', 'cuisine'],
                  fuzzy: {
                    maxEdits: 1,
                    prefixLength: 2,
                  },
                },
              },
            ],
          },
        },
      });
    }

    // Apply filters
    const matchStage: any = {};

    if (filters.dietary?.length) {
      matchStage.dietary_preferences = { $all: filters.dietary };
    }

    if (filters.cuisine?.length) {
      matchStage.cuisine = { $in: filters.cuisine };
    }

    if (filters.difficulty?.length) {
      matchStage.difficulty = { $in: filters.difficulty };
    }

    if (filters.cookingTime) {
      matchStage.cooking_time = {
        $gte: filters.cookingTime.min || 0,
        $lte: filters.cookingTime.max || Number.MAX_SAFE_INTEGER,
      };
    }

    if (filters.ingredients?.length) {
      matchStage['ingredients.name'] = { $all: filters.ingredients };
    }

    if (Object.keys(matchStage).length > 0) {
      pipeline.push({ $match: matchStage });
    }

    // Add rating and review data
    pipeline.push({
      $lookup: {
        from: 'reviews',
        localField: '_id',
        foreignField: 'recipe_id',
        as: 'reviews',
      },
    });

    pipeline.push({
      $addFields: {
        average_rating: {
          $cond: [{ $eq: [{ $size: '$reviews' }, 0] }, 0, { $avg: '$reviews.rating' }],
        },
        review_count: { $size: '$reviews' },
      },
    });

    // Apply sorting
    const sortStage: any = {};
    switch (sort) {
      case this.SORT_OPTIONS.RELEVANCE:
        if (query) {
          sortStage.score = { $meta: 'textScore' };
        }
        break;
      case this.SORT_OPTIONS.DATE:
        sortStage.created_at = -1;
        break;
      case this.SORT_OPTIONS.RATING:
        sortStage.average_rating = -1;
        sortStage.review_count = -1;
        break;
      case this.SORT_OPTIONS.COOKING_TIME:
        sortStage.cooking_time = 1;
        break;
      case this.SORT_OPTIONS.DIFFICULTY:
        sortStage.difficulty = 1;
        break;
    }

    if (Object.keys(sortStage).length > 0) {
      pipeline.push({ $sort: sortStage });
    }

    // Pagination
    pipeline.push({ $skip: skip });
    pipeline.push({ $limit: limit });

    // Get results
    const recipes = await db.getDb().then(db => db.collection('recipes').aggregate(pipeline).toArray());

    // Get total count
    const countPipeline = [...pipeline];
    countPipeline.splice(-2); // Remove skip and limit stages
    countPipeline.push({ $count: 'total' });
    const [countResult] = await db.getDb().then(db => db.collection('recipes').aggregate(countPipeline).toArray());

    return {
      recipes,
      pagination: {
        total: countResult?.total || 0,
        page,
        limit,
        pages: Math.ceil((countResult?.total || 0) / limit),
      },
    };
  }

  async searchUsers(query: string, filters: UserFilters = {}, page: number = 1, limit: number = 10): Promise<UserSearchResult> {
    const skip = (page - 1) * limit;

    const pipeline: object[] = [];

    if (query) {
      pipeline.push({
        $search: {
          index: 'users_search',
          compound: {
            should: [
              {
                text: {
                  query: query,
                  path: ['username', 'name'],
                  fuzzy: {
                    maxEdits: 1,
                    prefixLength: 3,
                  },
                },
              },
              {
                text: {
                  query: query,
                  path: ['bio', 'interests'],
                  fuzzy: {
                    maxEdits: 1,
                    prefixLength: 2,
                  },
                },
              },
            ],
          },
        },
      });
    }

    // Apply filters
    const matchStage: any = {};

    if (filters.role) {
      matchStage.role = filters.role;
    }

    if (filters.subscription_tier) {
      matchStage.subscription_tier = filters.subscription_tier;
    }

    if (Object.keys(matchStage).length > 0) {
      pipeline.push({ $match: matchStage });
    }

    // Add follower counts
    pipeline.push({
      $lookup: {
        from: 'follows',
        localField: '_id',
        foreignField: 'following_id',
        as: 'followers',
      },
    });

    pipeline.push({
      $lookup: {
        from: 'follows',
        localField: '_id',
        foreignField: 'follower_id',
        as: 'following',
      },
    });

    pipeline.push({
      $addFields: {
        follower_count: { $size: '$followers' },
        following_count: { $size: '$following' },
      },
    });

    // Remove sensitive information
    pipeline.push({
      $project: {
        password: 0,
        email: 0,
        followers: 0,
        following: 0,
      },
    });

    // Pagination
    pipeline.push({ $skip: skip });
    pipeline.push({ $limit: limit });

    const users = await db.getDb().then(db => db.collection('users').aggregate(pipeline).toArray());

    const countPipeline = [...pipeline];
    countPipeline.splice(-2);
    countPipeline.push({ $count: 'total' });
    const [countResult] = await db.getDb().then(db => db.collection('users').aggregate(countPipeline).toArray());

    return {
      users,
      pagination: {
        total: countResult?.total || 0,
        page,
        limit,
        pages: Math.ceil((countResult?.total || 0) / limit),
      },
    };
  }

  async searchCollections(query: string, userId: string | null = null, page: number = 1, limit: number = 10): Promise<CollectionSearchResult> {
    const skip = (page - 1) * limit;

    const pipeline: object[] = [];

    if (query) {
      pipeline.push({
        $search: {
          index: 'collections_search',
          text: {
            query: query,
            path: ['name', 'description'],
            fuzzy: {
              maxEdits: 1,
              prefixLength: 3,
            },
          },
        },
      });
    }

    // Filter by user if specified
      if (userId) {
        pipeline.push({
          $match: { user_id: new ObjectId(userId) },
        });
      }

    // Add recipe counts
    pipeline.push({
      $lookup: {
        from: 'saved_recipes',
        localField: '_id',
        foreignField: 'collection_id',
        as: 'recipes',
      },
    });

    pipeline.push({
      $addFields: {
        recipe_count: { $size: '$recipes' },
      },
    });

    // Remove recipe details
    pipeline.push({
      $project: {
        recipes: 0,
      },
    });

    // Pagination
    pipeline.push({ $skip: skip });
    pipeline.push({ $limit: limit });

    const collections = await db.getDb().then(db => db.collection('collections').aggregate(pipeline).toArray());

    const countPipeline = [...pipeline];
    countPipeline.splice(-2);
    countPipeline.push({ $count: 'total' });
    const [countResult] = await db.getDb().then(db => db.collection('collections').aggregate(countPipeline).toArray());

    return {
      collections,
      pagination: {
        total: countResult?.total || 0,
        page,
        limit,
        pages: Math.ceil((countResult?.total || 0) / limit),
      },
    };
  }

  async getSearchSuggestions(query: string, type: string = 'recipe') {
    const pipeline: object[] = [];

    pipeline.push({
      $search: {
        index: `${type}s_search`,
        autocomplete: {
          query: query,
          path: type === 'recipe' ? 'title' : 'username',
          fuzzy: {
            maxEdits: 1,
            prefixLength: 3,
          },
        },
      },
    });

    pipeline.push({ $limit: 5 });

    pipeline.push({
      $project: {
        _id: 1,
        [type === 'recipe' ? 'title' : 'username']: 1,
        score: { $meta: 'searchScore' },
      },
    });

    return await db.getDb().then(db => db.collection(`${type}s`).aggregate(pipeline).toArray());
  }
}

export default new SearchService();
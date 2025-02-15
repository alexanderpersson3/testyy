const jobQueue = require('../job-queue');
const { getDb } = require('../../db');
const { ObjectId } = require('mongodb');
const elasticClient = require('../elastic-client');

class SearchProcessor {
  constructor() {
    // Initialize processor
    jobQueue.processQueue('search', this.processJob.bind(this));

    // Search job types
    this.JOB_TYPES = {
      INDEX_RECIPE: 'index_recipe',
      INDEX_USER: 'index_user',
      INDEX_INGREDIENT: 'index_ingredient',
      REINDEX_ALL: 'reindex_all',
      UPDATE_SEARCH_STATS: 'update_search_stats',
      OPTIMIZE_INDICES: 'optimize_indices',
    };

    // Elasticsearch indices
    this.INDICES = {
      RECIPES: 'recipes',
      USERS: 'users',
      INGREDIENTS: 'ingredients',
    };
  }

  /**
   * Process search job
   */
  async processJob(job) {
    const { type, data } = job.data;

    try {
      switch (type) {
        case this.JOB_TYPES.INDEX_RECIPE:
          return await this.indexRecipe(data);
        case this.JOB_TYPES.INDEX_USER:
          return await this.indexUser(data);
        case this.JOB_TYPES.INDEX_INGREDIENT:
          return await this.indexIngredient(data);
        case this.JOB_TYPES.REINDEX_ALL:
          return await this.reindexAll(data);
        case this.JOB_TYPES.UPDATE_SEARCH_STATS:
          return await this.updateSearchStats(data);
        case this.JOB_TYPES.OPTIMIZE_INDICES:
          return await this.optimizeIndices(data);
        default:
          throw new Error(`Unknown search job type: ${type}`);
      }
    } catch (error) {
      console.error(`Error processing search job ${job.id}:`, error);
      await this.logSearchError(type, data, error);
      throw error;
    }
  }

  /**
   * Index a recipe
   */
  async indexRecipe(data) {
    try {
      const db = getDb();
      const recipe = await db.collection('recipes').findOne({
        _id: new ObjectId(data.recipeId),
      });

      if (!recipe) {
        throw new Error(`Recipe not found: ${data.recipeId}`);
      }

      const searchDoc = {
        id: recipe._id.toString(),
        title: recipe.title,
        description: recipe.description,
        ingredients: recipe.ingredients.map(i => ({
          name: i.name,
          amount: i.amount,
          unit: i.unit,
        })),
        instructions: recipe.instructions,
        tags: recipe.tags,
        cuisine: recipe.cuisine,
        difficulty: recipe.difficulty,
        prepTime: recipe.prepTime,
        cookTime: recipe.cookTime,
        servings: recipe.servings,
        calories: recipe.nutritionInfo?.calories,
        author: {
          id: recipe.userId.toString(),
          name: recipe.userName,
        },
        ratings: {
          average: recipe.averageRating,
          count: recipe.ratingCount,
        },
        popularity: recipe.popularity,
        createdAt: recipe.createdAt,
        updatedAt: recipe.updatedAt,
      };

      await elasticClient.index({
        index: this.INDICES.RECIPES,
        id: recipe._id.toString(),
        body: searchDoc,
        refresh: true,
      });

      await this.logSearchOperation('index_recipe', {
        recipeId: recipe._id,
        status: 'success',
      });
    } catch (error) {
      console.error('Error indexing recipe:', error);
      throw error;
    }
  }

  /**
   * Index a user
   */
  async indexUser(data) {
    try {
      const db = getDb();
      const user = await db.collection('users').findOne({
        _id: new ObjectId(data.userId),
      });

      if (!user) {
        throw new Error(`User not found: ${data.userId}`);
      }

      const searchDoc = {
        id: user._id.toString(),
        username: user.username,
        displayName: user.displayName,
        bio: user.bio,
        expertise: user.expertise,
        specialties: user.specialties,
        location: user.location,
        recipeCount: user.recipeCount,
        followerCount: user.followerCount,
        followingCount: user.followingCount,
        averageRating: user.averageRating,
        popularity: user.popularity,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      };

      await elasticClient.index({
        index: this.INDICES.USERS,
        id: user._id.toString(),
        body: searchDoc,
        refresh: true,
      });

      await this.logSearchOperation('index_user', {
        userId: user._id,
        status: 'success',
      });
    } catch (error) {
      console.error('Error indexing user:', error);
      throw error;
    }
  }

  /**
   * Index an ingredient
   */
  async indexIngredient(data) {
    try {
      const db = getDb();
      const ingredient = await db.collection('ingredients').findOne({
        _id: new ObjectId(data.ingredientId),
      });

      if (!ingredient) {
        throw new Error(`Ingredient not found: ${data.ingredientId}`);
      }

      const searchDoc = {
        id: ingredient._id.toString(),
        name: ingredient.name,
        category: ingredient.category,
        alternateNames: ingredient.alternateNames,
        description: ingredient.description,
        nutritionInfo: ingredient.nutritionInfo,
        seasonality: ingredient.seasonality,
        commonUses: ingredient.commonUses,
        storageInfo: ingredient.storageInfo,
        priceRange: ingredient.priceRange,
        popularity: ingredient.popularity,
        createdAt: ingredient.createdAt,
        updatedAt: ingredient.updatedAt,
      };

      await elasticClient.index({
        index: this.INDICES.INGREDIENTS,
        id: ingredient._id.toString(),
        body: searchDoc,
        refresh: true,
      });

      await this.logSearchOperation('index_ingredient', {
        ingredientId: ingredient._id,
        status: 'success',
      });
    } catch (error) {
      console.error('Error indexing ingredient:', error);
      throw error;
    }
  }

  /**
   * Reindex all documents
   */
  async reindexAll(data) {
    try {
      const db = getDb();
      const { collections = Object.values(this.INDICES) } = data;

      for (const collection of collections) {
        console.log(`Reindexing ${collection}...`);

        // Delete existing index
        const indexExists = await elasticClient.indices.exists({
          index: collection,
        });

        if (indexExists) {
          await elasticClient.indices.delete({
            index: collection,
          });
        }

        // Create new index with mapping
        await this.createIndex(collection);

        // Batch index documents
        const cursor = db.collection(collection).find();
        let batch = [];
        const BATCH_SIZE = 1000;

        while (await cursor.hasNext()) {
          const doc = await cursor.next();
          batch.push(doc);

          if (batch.length >= BATCH_SIZE) {
            await this.bulkIndex(collection, batch);
            batch = [];
          }
        }

        if (batch.length > 0) {
          await this.bulkIndex(collection, batch);
        }

        console.log(`Finished reindexing ${collection}`);
      }

      await this.logSearchOperation('reindex_all', {
        collections,
        status: 'success',
      });
    } catch (error) {
      console.error('Error reindexing all:', error);
      throw error;
    }
  }

  /**
   * Update search statistics
   */
  async updateSearchStats(data) {
    try {
      const db = getDb();
      const { startDate, endDate } = data;

      // Get search logs for the period
      const searchLogs = await db
        .collection('search_logs')
        .find({
          timestamp: {
            $gte: new Date(startDate),
            $lte: new Date(endDate),
          },
        })
        .toArray();

      // Calculate statistics
      const stats = {
        totalSearches: searchLogs.length,
        uniqueUsers: new Set(searchLogs.map(log => log.userId?.toString())).size,
        averageResults:
          searchLogs.reduce((acc, log) => acc + log.resultCount, 0) / searchLogs.length,
        noResultsCount: searchLogs.filter(log => log.resultCount === 0).length,
        popularTerms: this.calculatePopularTerms(searchLogs),
        categoryBreakdown: this.calculateCategoryBreakdown(searchLogs),
        averageResponseTime:
          searchLogs.reduce((acc, log) => acc + log.responseTime, 0) / searchLogs.length,
      };

      // Save statistics
      await db.collection('search_stats').insertOne({
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        stats,
        createdAt: new Date(),
      });

      await this.logSearchOperation('update_stats', {
        startDate,
        endDate,
        status: 'success',
      });

      return stats;
    } catch (error) {
      console.error('Error updating search stats:', error);
      throw error;
    }
  }

  /**
   * Optimize search indices
   */
  async optimizeIndices(data) {
    try {
      const { indices = Object.values(this.INDICES) } = data;

      for (const index of indices) {
        console.log(`Optimizing index: ${index}`);

        // Force merge to optimize
        await elasticClient.indices.forcemerge({
          index,
          max_num_segments: 1,
        });

        // Refresh index
        await elasticClient.indices.refresh({
          index,
        });

        console.log(`Finished optimizing index: ${index}`);
      }

      await this.logSearchOperation('optimize_indices', {
        indices,
        status: 'success',
      });
    } catch (error) {
      console.error('Error optimizing indices:', error);
      throw error;
    }
  }

  /**
   * Create index with mapping
   */
  async createIndex(index) {
    const mappings = {
      [this.INDICES.RECIPES]: {
        properties: {
          title: { type: 'text', analyzer: 'standard' },
          description: { type: 'text', analyzer: 'standard' },
          ingredients: {
            properties: {
              name: { type: 'text', analyzer: 'standard' },
              amount: { type: 'float' },
              unit: { type: 'keyword' },
            },
          },
          instructions: { type: 'text', analyzer: 'standard' },
          tags: { type: 'keyword' },
          cuisine: { type: 'keyword' },
          difficulty: { type: 'keyword' },
          prepTime: { type: 'integer' },
          cookTime: { type: 'integer' },
          servings: { type: 'integer' },
          calories: { type: 'integer' },
          author: {
            properties: {
              id: { type: 'keyword' },
              name: { type: 'text', analyzer: 'standard' },
            },
          },
          ratings: {
            properties: {
              average: { type: 'float' },
              count: { type: 'integer' },
            },
          },
          popularity: { type: 'float' },
          createdAt: { type: 'date' },
          updatedAt: { type: 'date' },
        },
      },
      [this.INDICES.USERS]: {
        properties: {
          username: { type: 'keyword' },
          displayName: { type: 'text', analyzer: 'standard' },
          bio: { type: 'text', analyzer: 'standard' },
          expertise: { type: 'keyword' },
          specialties: { type: 'keyword' },
          location: { type: 'text', analyzer: 'standard' },
          recipeCount: { type: 'integer' },
          followerCount: { type: 'integer' },
          followingCount: { type: 'integer' },
          averageRating: { type: 'float' },
          popularity: { type: 'float' },
          createdAt: { type: 'date' },
          updatedAt: { type: 'date' },
        },
      },
      [this.INDICES.INGREDIENTS]: {
        properties: {
          name: { type: 'text', analyzer: 'standard' },
          category: { type: 'keyword' },
          alternateNames: { type: 'text', analyzer: 'standard' },
          description: { type: 'text', analyzer: 'standard' },
          nutritionInfo: { type: 'object' },
          seasonality: { type: 'keyword' },
          commonUses: { type: 'text', analyzer: 'standard' },
          storageInfo: { type: 'text', analyzer: 'standard' },
          priceRange: {
            properties: {
              min: { type: 'float' },
              max: { type: 'float' },
            },
          },
          popularity: { type: 'float' },
          createdAt: { type: 'date' },
          updatedAt: { type: 'date' },
        },
      },
    };

    await elasticClient.indices.create({
      index,
      body: {
        settings: {
          number_of_shards: 1,
          number_of_replicas: 1,
          analysis: {
            analyzer: {
              standard: {
                type: 'standard',
                stopwords: '_english_',
              },
            },
          },
        },
        mappings: mappings[index],
      },
    });
  }

  /**
   * Bulk index documents
   */
  async bulkIndex(index, documents) {
    const operations = documents.flatMap(doc => [
      { index: { _index: index, _id: doc._id.toString() } },
      this.transformDocumentForIndex(index, doc),
    ]);

    const { body: bulkResponse } = await elasticClient.bulk({
      refresh: true,
      body: operations,
    });

    if (bulkResponse.errors) {
      const erroredDocuments = [];
      bulkResponse.items.forEach((action, i) => {
        const operation = Object.keys(action)[0];
        if (action[operation].error) {
          erroredDocuments.push({
            status: action[operation].status,
            error: action[operation].error,
            operation: operations[i * 2],
            document: operations[i * 2 + 1],
          });
        }
      });
      console.error('Bulk index errors:', erroredDocuments);
    }
  }

  /**
   * Transform document for indexing
   */
  transformDocumentForIndex(index, doc) {
    switch (index) {
      case this.INDICES.RECIPES:
        return {
          id: doc._id.toString(),
          title: doc.title,
          description: doc.description,
          ingredients: doc.ingredients,
          instructions: doc.instructions,
          tags: doc.tags,
          cuisine: doc.cuisine,
          difficulty: doc.difficulty,
          prepTime: doc.prepTime,
          cookTime: doc.cookTime,
          servings: doc.servings,
          calories: doc.nutritionInfo?.calories,
          author: {
            id: doc.userId.toString(),
            name: doc.userName,
          },
          ratings: {
            average: doc.averageRating,
            count: doc.ratingCount,
          },
          popularity: doc.popularity,
          createdAt: doc.createdAt,
          updatedAt: doc.updatedAt,
        };
      case this.INDICES.USERS:
        return {
          id: doc._id.toString(),
          username: doc.username,
          displayName: doc.displayName,
          bio: doc.bio,
          expertise: doc.expertise,
          specialties: doc.specialties,
          location: doc.location,
          recipeCount: doc.recipeCount,
          followerCount: doc.followerCount,
          followingCount: doc.followingCount,
          averageRating: doc.averageRating,
          popularity: doc.popularity,
          createdAt: doc.createdAt,
          updatedAt: doc.updatedAt,
        };
      case this.INDICES.INGREDIENTS:
        return {
          id: doc._id.toString(),
          name: doc.name,
          category: doc.category,
          alternateNames: doc.alternateNames,
          description: doc.description,
          nutritionInfo: doc.nutritionInfo,
          seasonality: doc.seasonality,
          commonUses: doc.commonUses,
          storageInfo: doc.storageInfo,
          priceRange: doc.priceRange,
          popularity: doc.popularity,
          createdAt: doc.createdAt,
          updatedAt: doc.updatedAt,
        };
      default:
        throw new Error(`Unknown index: ${index}`);
    }
  }

  /**
   * Calculate popular search terms
   */
  calculatePopularTerms(searchLogs) {
    const termCounts = {};
    searchLogs.forEach(log => {
      const terms = log.query.toLowerCase().split(/\s+/);
      terms.forEach(term => {
        termCounts[term] = (termCounts[term] || 0) + 1;
      });
    });

    return Object.entries(termCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 20)
      .map(([term, count]) => ({ term, count }));
  }

  /**
   * Calculate category breakdown
   */
  calculateCategoryBreakdown(searchLogs) {
    const categoryCount = {};
    searchLogs.forEach(log => {
      if (log.category) {
        categoryCount[log.category] = (categoryCount[log.category] || 0) + 1;
      }
    });

    return Object.entries(categoryCount).map(([category, count]) => ({
      category,
      count,
      percentage: (count / searchLogs.length) * 100,
    }));
  }

  /**
   * Log search operation
   */
  async logSearchOperation(operation, data) {
    try {
      const db = getDb();
      await db.collection('search_logs').insertOne({
        operation,
        data,
        timestamp: new Date(),
      });
    } catch (error) {
      console.error('Error logging search operation:', error);
    }
  }

  /**
   * Log search error
   */
  async logSearchError(type, data, error) {
    try {
      const db = getDb();
      await db.collection('search_error_logs').insertOne({
        type,
        data,
        error: {
          message: error.message,
          stack: error.stack,
        },
        timestamp: new Date(),
      });
    } catch (logError) {
      console.error('Error logging search error:', logError);
    }
  }
}

// Export singleton instance
module.exports = new SearchProcessor();

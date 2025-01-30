const { getDb } = require('../db');

class QueryOptimizer {
  constructor() {
    this.indexConfigs = {
      recipes: [
        { fields: { title: 'text', description: 'text', 'ingredients.name': 'text' } },
        { fields: { userId: 1, status: 1, createdAt: -1 } },
        { fields: { createdAt: -1 } },
        { fields: { status: 1, type: 1, createdAt: -1 } },
        { fields: { 'ingredients.name': 1, status: 1 } },
        { fields: { popularity: -1, status: 1 } },
        { fields: { averageRating: -1, status: 1 } }
      ],
      users: [
        { fields: { email: 1 }, options: { unique: true } },
        { fields: { username: 1 }, options: { unique: true } },
        { fields: { role: 1, status: 1 } },
        { fields: { name: 'text', username: 'text' } },
        { fields: { lastLoginAt: -1 } },
        { fields: { createdAt: -1 } }
      ],
      ingredients: [
        { fields: { name: 'text' } },
        { fields: { category: 1, status: 1 } },
        { fields: { store: 1, currentPrice: 1, updatedAt: -1 } },
        { fields: { popularity: -1 } }
      ],
      priceHistory: [
        { fields: { ingredientId: 1, timestamp: -1 } },
        { fields: { store: 1, timestamp: -1 } },
        { fields: { timestamp: -1 } },
        { fields: { ingredientId: 1, store: 1, timestamp: -1 } }
      ],
      priceAlerts: [
        { fields: { userId: 1, status: 1 } },
        { fields: { ingredientId: 1, type: 1, status: 1 } },
        { fields: { triggeredAt: -1 } }
      ],
      likes: [
        { fields: { recipeId: 1, userId: 1 }, options: { unique: true } },
        { fields: { recipeId: 1, createdAt: -1 } },
        { fields: { userId: 1, createdAt: -1 } }
      ],
      comments: [
        { fields: { recipeId: 1, createdAt: -1 } },
        { fields: { userId: 1, createdAt: -1 } },
        { fields: { recipeId: 1, parentId: 1, createdAt: -1 } }
      ],
      followers: [
        { fields: { followerId: 1, followingId: 1 }, options: { unique: true } },
        { fields: { followerId: 1, createdAt: -1 } },
        { fields: { followingId: 1, createdAt: -1 } }
      ],
      media: [
        { fields: { userId: 1, type: 1, status: 1 } },
        { fields: { status: 1, processingStartedAt: -1 } },
        { fields: { type: 1, createdAt: -1 } }
      ],
      activities: [
        { fields: { userId: 1, type: 1, createdAt: -1 } },
        { fields: { recipeId: 1, type: 1, createdAt: -1 } },
        { fields: { createdAt: -1 } }
      ]
    };

    this.queryHints = {
      'recipes.search': { hint: { title: 'text', description: 'text' } },
      'recipes.byIngredient': { hint: { 'ingredients.name': 1, status: 1 } },
      'recipes.userRecipes': { hint: { userId: 1, status: 1, createdAt: -1 } },
      'recipes.popular': { hint: { popularity: -1, status: 1 } },
      'ingredients.priceRange': { hint: { store: 1, currentPrice: 1, updatedAt: -1 } },
      'users.search': { hint: { name: 'text', username: 'text' } },
      'media.processing': { hint: { status: 1, processingStartedAt: -1 } }
    };

    this.coveredQueries = [
      'recipes.list',
      'users.list',
      'ingredients.list'
    ];
  }

  async setupIndexes() {
    try {
      const db = getDb();
      
      for (const [collection, indexes] of Object.entries(this.indexConfigs)) {
        console.log(`Setting up indexes for ${collection}...`);
        
        for (const index of indexes) {
          try {
            await db.collection(collection).createIndex(
              index.fields,
              {
                background: true,
                ...index.options
              }
            );
            console.log(`Created index on ${collection}: ${JSON.stringify(index.fields)}`);
          } catch (err) {
            if (!err.message.includes('already exists')) {
              console.error(`Error creating index on ${collection}:`, err);
            }
          }
        }
      }
      
      console.log('All indexes setup complete');
    } catch (err) {
      console.error('Error setting up indexes:', err);
    }
  }

  async analyzeQuery(collection, query, sort = {}, options = {}) {
    try {
      const db = getDb();
      
      const explainResult = await db.collection(collection)
        .find(query)
        .sort(sort)
        .explain('executionStats');

      const stats = explainResult.executionStats;
      const isOptimal = stats.executionTimeMillis < 100 && 
                       stats.totalDocsExamined <= stats.nReturned * 2;

      const couldBeCovered = this.coveredQueries.includes(this.identifyQueryType(collection, query)) &&
                            !explainResult.queryPlanner.winningPlan.inputStage?.inputStage;

      return {
        isOptimal,
        executionTimeMs: stats.executionTimeMillis,
        docsExamined: stats.totalDocsExamined,
        docsReturned: stats.nReturned,
        indexUsed: explainResult.queryPlanner.winningPlan.inputStage?.indexName || 'none',
        couldBeCovered,
        suggestion: this.getSuggestion(collection, query, stats, couldBeCovered)
      };
    } catch (err) {
      console.error('Error analyzing query:', err);
      return null;
    }
  }

  getSuggestion(collection, query, stats, couldBeCovered) {
    if (stats.executionTimeMillis > 100) {
      const queryType = this.identifyQueryType(collection, query);
      const hint = this.queryHints[queryType];
      
      if (hint) {
        return `Consider using index hint: ${JSON.stringify(hint)}`;
      }
      
      if (stats.totalDocsExamined > stats.nReturned * 10) {
        return 'Consider adding a specific index for this query pattern';
      }
    }

    if (!couldBeCovered && this.coveredQueries.includes(this.identifyQueryType(collection, query))) {
      return 'This query could potentially use a covered index';
    }

    return 'Query performance is acceptable';
  }

  identifyQueryType(collection, query) {
    const queryStr = JSON.stringify(query);
    
    if (collection === 'recipes') {
      if (queryStr.includes('$text')) return 'recipes.search';
      if (queryStr.includes('ingredients.name')) return 'recipes.byIngredient';
      if (queryStr.includes('userId')) return 'recipes.userRecipes';
      if (queryStr.includes('popularity')) return 'recipes.popular';
      return 'recipes.list';
    }
    
    if (collection === 'ingredients' && queryStr.includes('currentPrice')) {
      return 'ingredients.priceRange';
    }

    if (collection === 'users' && queryStr.includes('$text')) {
      return 'users.search';
    }

    if (collection === 'media' && queryStr.includes('status')) {
      return 'media.processing';
    }
    
    return `${collection}.list`;
  }

  async getCollectionStats(collection) {
    try {
      const db = getDb();
      return await db.collection(collection).stats();
    } catch (err) {
      console.error(`Error getting stats for ${collection}:`, err);
      return null;
    }
  }

  async getIndexStats(collection) {
    try {
      const db = getDb();
      const indexes = await db.collection(collection).indexes();
      const stats = await this.getCollectionStats(collection);
      
      return {
        indexes: indexes.map(index => ({
          name: index.name,
          fields: index.key,
          size: stats.indexSizes[index.name],
          unique: !!index.unique,
          background: !!index.background
        })),
        totalIndexSize: stats.totalIndexSize,
        avgObjSize: stats.avgObjSize,
        documentCount: stats.count
      };
    } catch (err) {
      console.error(`Error getting index stats for ${collection}:`, err);
      return null;
    }
  }

  async analyzeCollectionPerformance(collection) {
    try {
      const db = getDb();
      const stats = await this.getCollectionStats(collection);
      const indexes = await this.getIndexStats(collection);
      
      const performance = {
        documentCount: stats.count,
        avgObjSize: stats.avgObjSize,
        totalDataSize: stats.size,
        totalIndexSize: stats.totalIndexSize,
        indexCount: indexes.indexes.length,
        indexSizes: indexes.indexes.reduce((acc, idx) => {
          acc[idx.name] = idx.size;
          return acc;
        }, {}),
        suggestions: []
      };

      if (performance.totalIndexSize > performance.totalDataSize * 0.5) {
        performance.suggestions.push('Index size is over 50% of data size. Consider removing unused indexes.');
      }

      if (performance.indexCount > 5) {
        performance.suggestions.push('High number of indexes. Review index usage statistics.');
      }

      return performance;
    } catch (err) {
      console.error(`Error analyzing collection performance for ${collection}:`, err);
      return null;
    }
  }
}

module.exports = new QueryOptimizer(); 
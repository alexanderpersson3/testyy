import { getDb } from '../config/db.js';
import { ObjectId } from 'mongodb';

class IngredientManager {
  constructor() {
    // Common ingredient aliases for matching
    this.ingredientAliases = {
      'tomato puree': ['tomato paste', 'passata'],
      'heavy cream': ['whipping cream', 'double cream'],
      scallion: ['green onion', 'spring onion'],
      // Add more aliases as needed
    };
  }

  /**
   * Search ingredients with various filters
   * @param {Object} params Search parameters
   * @returns {Promise<Array>} Matching ingredients
   */
  async searchIngredients({
    query,
    category,
    storeId,
    nutritionFilters,
    priceRange,
    inStock,
    page = 1,
    limit = 20,
  }) {
    try {
      const db = getDb();
      const skip = (page - 1) * limit;

      // Build search query
      const searchQuery = {};
      const searchPipeline = [];

      // Text search with aliases
      if (query) {
        const aliases = this.findAliases(query);
        searchQuery.$or = [
          { name: { $regex: new RegExp(query, 'i') } },
          ...aliases.map(alias => ({ name: { $regex: new RegExp(alias, 'i') } })),
        ];
      }

      // Category filter
      if (category) {
        searchQuery.category = category;
      }

      // Store filter
      if (storeId) {
        searchQuery['stores.storeId'] = new ObjectId(storeId);
      }

      // Price range filter
      if (priceRange) {
        searchQuery.newPrice = {
          $gte: priceRange.min,
          $lte: priceRange.max,
        };
      }

      // Stock filter
      if (inStock !== undefined) {
        searchQuery.inStock = inStock;
      }

      // Nutrition filters
      if (nutritionFilters) {
        Object.entries(nutritionFilters).forEach(([nutrient, value]) => {
          if (value.min !== undefined) {
            searchQuery[`nutritionalInfo.${nutrient}`] = {
              $gte: value.min,
            };
          }
          if (value.max !== undefined) {
            searchQuery[`nutritionalInfo.${nutrient}`] = {
              ...searchQuery[`nutritionalInfo.${nutrient}`],
              $lte: value.max,
            };
          }
        });
      }

      // Build aggregation pipeline
      searchPipeline.push({ $match: searchQuery });

      // Add store information
      searchPipeline.push({
        $lookup: {
          from: 'stores',
          localField: 'stores.storeId',
          foreignField: '_id',
          as: 'storeDetails',
        },
      });

      // Add pagination
      searchPipeline.push({ $skip: skip });
      searchPipeline.push({ $limit: limit });

      // Execute search
      const ingredients = await db.collection('ingredients').aggregate(searchPipeline).toArray();

      // Get total count for pagination
      const totalCount = await db.collection('ingredients').countDocuments(searchQuery);

      return {
        ingredients,
        pagination: {
          total: totalCount,
          page,
          limit,
          pages: Math.ceil(totalCount / limit),
        },
      };
    } catch (error) {
      console.error('Error searching ingredients:', error);
      throw error;
    }
  }

  /**
   * Find ingredient aliases
   * @param {string} ingredientName Original ingredient name
   * @returns {Array<string>} List of aliases
   */
  findAliases(ingredientName) {
    const normalizedName = ingredientName.toLowerCase();
    const aliases = [];

    // Check direct aliases
    for (const [main, alternates] of Object.entries(this.ingredientAliases)) {
      if (main === normalizedName || alternates.includes(normalizedName)) {
        aliases.push(main, ...alternates);
      }
    }

    // Remove the original name from aliases
    return aliases.filter(alias => alias !== normalizedName);
  }

  /**
   * Get ingredient price history
   * @param {string} ingredientId Ingredient ID
   * @param {Object} options Query options
   * @returns {Promise<Array>} Price history
   */
  async getPriceHistory(ingredientId, { days = 30, storeId = null } = {}) {
    try {
      const db = getDb();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const query = {
        ingredientId: new ObjectId(ingredientId),
        timestamp: { $gte: startDate },
      };

      if (storeId) {
        query.storeId = new ObjectId(storeId);
      }

      return await db.collection('priceHistory').find(query).sort({ timestamp: 1 }).toArray();
    } catch (error) {
      console.error('Error getting price history:', error);
      throw error;
    }
  }

  /**
   * Track ingredient price changes
   * @param {string} ingredientId Ingredient ID
   * @param {Object} priceData New price data
   */
  async trackPriceChange(ingredientId, { storeId, newPrice, oldPrice }) {
    try {
      const db = getDb();

      // Record price history
      await db.collection('priceHistory').insertOne({
        ingredientId: new ObjectId(ingredientId),
        storeId: new ObjectId(storeId),
        price: newPrice,
        oldPrice,
        timestamp: new Date(),
      });

      // Update current price
      await db.collection('ingredients').updateOne(
        { _id: new ObjectId(ingredientId) },
        {
          $set: {
            'stores.$[store].price': newPrice,
            'stores.$[store].oldPrice': oldPrice,
            'stores.$[store].lastUpdated': new Date(),
          },
        },
        {
          arrayFilters: [{ 'store.storeId': new ObjectId(storeId) }],
        }
      );
    } catch (error) {
      console.error('Error tracking price change:', error);
      throw error;
    }
  }

  /**
   * Get ingredient substitutes
   * @param {string} ingredientId Ingredient ID
   * @returns {Promise<Array>} List of substitute ingredients
   */
  async getSubstitutes(ingredientId) {
    try {
      const db = getDb();
      const ingredient = await db.collection('ingredients').findOne({
        _id: new ObjectId(ingredientId),
      });

      if (!ingredient) {
        throw new Error('Ingredient not found');
      }

      // Find substitutes based on category and nutritional profile
      const substitutes = await db
        .collection('ingredients')
        .find({
          _id: { $ne: new ObjectId(ingredientId) },
          category: ingredient.category,
          // Match similar nutritional profile if available
          ...(ingredient.nutritionalInfo && {
            'nutritionalInfo.calories': {
              $gte: ingredient.nutritionalInfo.calories * 0.8,
              $lte: ingredient.nutritionalInfo.calories * 1.2,
            },
          }),
        })
        .limit(5)
        .toArray();

      return substitutes;
    } catch (error) {
      console.error('Error getting substitutes:', error);
      throw error;
    }
  }
}

export default new IngredientManager();

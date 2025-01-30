import { ObjectId } from 'mongodb';
import { db } from '../config/db.js';

let database = db;

// For testing purposes
export function setTestDb(testDb) {
  database = testDb;
}

export async function searchIngredients(query, options = {}) {
  const filter = {};
  
  // Add exact match filter if query is provided
  if (query && query.trim()) {
    filter.name = query.toLowerCase();
  }

  // Add category filter if provided
  if (options.category) {
    filter.category = options.category;
  }
  
  const limit = options.limit || 10;
  
  return await database.collection('normalized_ingredients')
    .find(filter)
    .sort({ name: 1 })
    .limit(limit)
    .toArray();
}

export async function getIngredientDetails(ingredientId) {
  if (!ObjectId.isValid(ingredientId)) {
    return null;
  }

  const ingredient = await database.collection('normalized_ingredients').findOne({
    _id: new ObjectId(ingredientId)
  });

  if (!ingredient) {
    return null;
  }

  // Calculate best prices per store
  const bestPrices = {};
  for (const product of ingredient.products) {
    if (!bestPrices[product.store] || product.price < bestPrices[product.store].price) {
      bestPrices[product.store] = {
        price: product.price,
        unit: product.unit,
        name: product.name
      };
    }
  }

  return {
    ...ingredient,
    best_prices: bestPrices
  };
}

export async function getIngredientCategories() {
  const categories = await database.collection('normalized_ingredients').aggregate([
    {
      $group: {
        _id: '$category',
        count: { $sum: 1 }
      }
    },
    {
      $project: {
        _id: 0,
        category: '$_id',
        count: 1
      }
    },
    {
      $sort: { category: 1 }
    }
  ]).toArray();

  return categories;
}

export async function syncScrapedIngredients(scrapedProducts) {
  let result = { inserted: 0, updated: 0 };
  const isTestEnv = process.env.NODE_ENV === 'test';

  if (!isTestEnv) {
    const session = database.client.startSession();
    try {
      await session.withTransaction(async () => {
        result = await syncProducts(scrapedProducts, session);
      });
    } finally {
      await session.endSession();
    }
  } else {
    result = await syncProducts(scrapedProducts);
  }

  return result;
}

async function syncProducts(scrapedProducts, session = null) {
  const result = { inserted: 0, updated: 0 };

  for (const product of scrapedProducts) {
    const normalizedName = normalizeIngredientName(product.name);
    
    // Find or create ingredient
    let ingredient = await database.collection('normalized_ingredients').findOne(
      { normalized_name: normalizedName },
      session ? { session } : {}
    );

    if (!ingredient) {
      const insertResult = await database.collection('normalized_ingredients').insertOne({
        name: normalizedName,
        normalized_name: normalizedName,
        category: product.category || 'uncategorized',
        products: [product],
        created_at: new Date(),
        updated_at: new Date()
      }, session ? { session } : {});
      
      result.inserted++;
      ingredient = { _id: insertResult.insertedId };
    } else {
      // Update existing ingredient
      const existingProductIndex = ingredient.products?.findIndex(
        p => p.name === product.name && p.store === product.store
      );

      if (existingProductIndex >= 0) {
        await database.collection('normalized_ingredients').updateOne(
          { _id: ingredient._id },
          {
            $set: {
              [`products.${existingProductIndex}`]: product,
              updated_at: new Date()
            }
          },
          session ? { session } : {}
        );
      } else {
        await database.collection('normalized_ingredients').updateOne(
          { _id: ingredient._id },
          {
            $push: { products: product },
            $set: { updated_at: new Date() }
          },
          session ? { session } : {}
        );
      }
      result.updated++;
    }
  }

  return result;
}

export function normalizeIngredientName(name) {
  return name
    .toLowerCase()
    // Remove brand names first
    .replace(/\b(?:ica|coop|garant|eldorado)\b/g, '')
    // Remove content in parentheses
    .replace(/\([^)]*\)/g, '')
    // Remove percentages
    .replace(/\d+\s*%/g, '')
    // Remove measurements with units (more comprehensive)
    .replace(/\d+(?:[.,]\d+)?\s*(?:l|g|ml|kg|gr|st|cl|dl|liter|gram|styck)\b/gi, '')
    // Replace multiple spaces with single space
    .replace(/\s+/g, ' ')
    .trim();
}

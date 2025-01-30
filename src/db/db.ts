import { MongoClient, Db } from 'mongodb';

let client: MongoClient | undefined;
let db: Db | undefined;

export async function connectToDatabase(): Promise<Db> {
  if (db) return db;

  try {
    client = await MongoClient.connect(process.env.MONGODB_URI || '');
    db = client.db();
    console.log('Connected to MongoDB');

    // Create indexes for commonly sorted fields
    await Promise.all([
      // Ingredient indexes
      db.collection('ingredients').createIndex({ name: 1 }),
      db.collection('ingredients').createIndex({ category: 1 }),
      db.collection('ingredients').createIndex({ 'nutritionalInfo.calories': 1 }),
      db.collection('ingredients').createIndex({ createdAt: -1 }),
      db.collection('ingredients').createIndex({ updatedAt: -1 }),

      // Recipe indexes
      db.collection('recipes').createIndex({ title: 1 }),
      db.collection('recipes').createIndex({ cuisine: 1 }),
      db.collection('recipes').createIndex({ difficulty: 1 }),
      db.collection('recipes').createIndex({ prepTime: 1 }),
      db.collection('recipes').createIndex({ cookTime: 1 }),
      db.collection('recipes').createIndex({ createdAt: -1 }),
      db.collection('recipes').createIndex({ updatedAt: -1 }),
      db.collection('recipes').createIndex({ authorId: 1 }),

      // Shopping list indexes
      db.collection('shopping_lists').createIndex({ userId: 1 }),
      db.collection('shopping_lists').createIndex({ userId: 1, updatedAt: -1 }),
      db.collection('shopping_lists').createIndex({ store: 1 }),
      db.collection('shopping_lists').createIndex({ 'collaborators.userId': 1 }),
      db.collection('shopping_lists').createIndex({ isShared: 1 }),
      db.collection('shopping_lists').createIndex({ 
        userId: 1, 
        'collaborators.userId': 1,
        updatedAt: -1 
      }),

      // Shopping list items indexes
      db.collection('shopping_list_items').createIndex({ listId: 1 }),
      db.collection('shopping_list_items').createIndex({ listId: 1, checked: 1 }),
      db.collection('shopping_list_items').createIndex({ listId: 1, createdAt: -1 }),
      db.collection('shopping_list_items').createIndex({ ingredientId: 1 }),
      db.collection('shopping_list_items').createIndex({ checkedBy: 1 }),

      // Favorite items indexes
      db.collection('favorite_items').createIndex({ userId: 1 }),
      db.collection('favorite_items').createIndex({ userId: 1, name: 1 }),
      db.collection('favorite_items').createIndex({ userId: 1, category: 1 }),
      db.collection('favorite_items').createIndex({ ingredientId: 1 }),
      db.collection('favorite_items').createIndex({ 
        userId: 1,
        name: 1,
        unit: 1
      }, { unique: true }),

      // Favorite recipes indexes
      db.collection('favorite_recipes').createIndex({ userId: 1 }),
      db.collection('favorite_recipes').createIndex({ userId: 1, recipeId: 1 }, { unique: true }),
      db.collection('favorite_recipes').createIndex({ userId: 1, personalTags: 1 }),
      db.collection('favorite_recipes').createIndex({ userId: 1, timesCooked: -1 }),
      db.collection('favorite_recipes').createIndex({ userId: 1, rating: -1 }),
      db.collection('favorite_recipes').createIndex({ recipeId: 1 }),

      // Recipe collections indexes
      db.collection('recipe_collections').createIndex({ userId: 1 }),
      db.collection('recipe_collections').createIndex({ userId: 1, order: 1 }),
      db.collection('recipe_collections').createIndex({ userId: 1, name: 1 }),
      db.collection('recipe_collections').createIndex({ userId: 1, isDefault: 1 }),
      db.collection('recipe_collections').createIndex({ recipeIds: 1 }),
      db.collection('recipe_collections').createIndex({ 'collaborators.userId': 1 }),
      db.collection('recipe_collections').createIndex({ isShared: 1 }),
      db.collection('recipe_collections').createIndex({ 
        userId: 1, 
        'collaborators.userId': 1,
        order: 1 
      }),

      // Collection activity logs indexes
      db.collection('collection_activities').createIndex({ collectionId: 1 }),
      db.collection('collection_activities').createIndex({ collectionId: 1, createdAt: -1 }),
      db.collection('collection_activities').createIndex({ userId: 1 }),
      db.collection('collection_activities').createIndex({ 
        collectionId: 1,
        type: 1,
        createdAt: -1
      })
    ]);

    return db;
  } catch (error) {
    console.error('MongoDB connection error:', error);
    throw error;
  }
}

export async function closeDatabase(): Promise<void> {
  if (client) {
    await client.close();
    console.log('Disconnected from MongoDB');
  }
}

export { client, db }; 
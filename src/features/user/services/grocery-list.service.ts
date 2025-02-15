import type { Recipe } from '../types/express.js';
import { connectToDatabase } from '../db.js';;

export interface GroceryItem {
  _id?: ObjectId;
  name: string;
  amount: number;
  unit: string;
  category?: string;
  checked: boolean;
  recipeId?: ObjectId;
  collectionId?: ObjectId;
  userId: ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface GroceryList {
  _id?: ObjectId;
  userId: ObjectId;
  name: string;
  items: GroceryItem[];
  collectionId?: ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export class GroceryListService {
  /**
   * Create a new grocery list
   */
  async createList(userId: string, name: string, collectionId?: string): Promise<ObjectId> {
    const db = await connectToDatabase();

    const list: Omit<GroceryList, '_id'> = {
      userId: new ObjectId(userId),
      name,
      items: [],
      ...(collectionId && { collectionId: new ObjectId(collectionId) }),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await db.collection<GroceryList>('grocery_lists').insertOne(list);
    return result.insertedId;
  }

  /**
   * Add items to grocery list
   */
  async addItems(
    listId: string,
    items: Array<Omit<GroceryItem, '_id' | 'userId' | 'createdAt' | 'updatedAt'>>,
    userId: string
  ): Promise<void> {
    const db = await connectToDatabase();

    const now = new Date();
    const groceryItems = items.map(item => ({
      ...item,
      userId: new ObjectId(userId),
      checked: false,
      createdAt: now,
      updatedAt: now,
    }));

    await db.collection<GroceryList>('grocery_lists').updateOne(
      { _id: new ObjectId(listId) },
      {
        $push: { items: { $each: groceryItems } },
        $set: { updatedAt: now },
      }
    );
  }

  /**
   * Add recipe ingredients to grocery list
   */
  async addRecipeIngredients(listId: string, recipeId: string, userId: string): Promise<void> {
    const db = await connectToDatabase();

    const recipe = await db.collection('recipes').findOne({ _id: new ObjectId(recipeId) });
    if (!recipe) {
      throw new Error('Recipe not found');
    }

    const ingredients = recipe.ingredients.map((ingredient: any) => ({
      name: ingredient.name,
      amount: ingredient.amount,
      unit: ingredient.unit,
      category: ingredient.category,
      recipeId: new ObjectId(recipeId),
      checked: false,
    }));

    await this.addItems(listId, ingredients, userId);
  }

  /**
   * Add collection recipe ingredients to grocery list
   */
  async addCollectionIngredients(
    listId: string,
    collectionId: string,
    userId: string
  ): Promise<void> {
    const db = await connectToDatabase();

    const collection = await db
      .collection('collections')
      .findOne({ _id: new ObjectId(collectionId) });
    if (!collection) {
      throw new Error('Collection not found');
    }

    for (const recipe of collection.recipes) {
      await this.addRecipeIngredients(listId, recipe.recipeId.toString(), userId);
    }
  }

  /**
   * Update item status
   */
  async updateItemStatus(listId: string, itemId: string, checked: boolean): Promise<void> {
    const db = await connectToDatabase();

    await db.collection<GroceryList>('grocery_lists').updateOne(
      {
        _id: new ObjectId(listId),
        'items._id': new ObjectId(itemId),
      },
      {
        $set: {
          'items.$.checked': checked,
          'items.$.updatedAt': new Date(),
        },
      }
    );
  }

  /**
   * Remove item from list
   */
  async removeItem(listId: string, itemId: string): Promise<void> {
    const db = await connectToDatabase();

    await db.collection<GroceryList>('grocery_lists').updateOne(
      { _id: new ObjectId(listId) },
      {
        $pull: { items: { _id: new ObjectId(itemId) } },
        $set: { updatedAt: new Date() },
      }
    );
  }

  /**
   * Clear completed items
   */
  async clearCompleted(listId: string): Promise<void> {
    const db = await connectToDatabase();

    await db.collection<GroceryList>('grocery_lists').updateOne(
      { _id: new ObjectId(listId) },
      {
        $pull: { items: { checked: true } },
        $set: { updatedAt: new Date() },
      }
    );
  }

  /**
   * Delete list
   */
  async deleteList(listId: string, userId: string): Promise<void> {
    const db = await connectToDatabase();

    await db.collection<GroceryList>('grocery_lists').deleteOne({
      _id: new ObjectId(listId),
      userId: new ObjectId(userId),
    });
  }

  /**
   * Get user's grocery lists
   */
  async getUserLists(userId: string): Promise<GroceryList[]> {
    const db = await connectToDatabase();

    return await db
      .collection<GroceryList>('grocery_lists')
      .find({ userId: new ObjectId(userId) })
      .sort({ updatedAt: -1 })
      .toArray();
  }

  /**
   * Get list by ID
   */
  async getList(listId: string, userId: string): Promise<GroceryList | null> {
    const db = await connectToDatabase();

    return await db.collection<GroceryList>('grocery_lists').findOne({
      _id: new ObjectId(listId),
      userId: new ObjectId(userId),
    });
  }
}

import { ObjectId } from 'mongodb';
import { connectToDatabase } from '../db/database.service.js';
import type { 
  ShoppingList,
  ShoppingListItem,
  CreateListDTO,
  UpdateListDTO,
  AddItemDTO,
  UpdateItemDTO,
  AddItemsFromRecipeDTO,
  ItemCategory
} from '../types/shopping-list.js';
import type {
  MongoFilter,
  MongoUpdate,
  MongoFindOptions,
  ModifyResult
} from '../types/mongodb.js';
import {
  MongoNotFoundError,
  MongoValidationError,
  MongoWriteError,
  MongoQueryError
} from '../types/mongodb-errors.js';
import { ValidationError } from '../types/validation-errors.js';
import { isMongoDocument, isObjectId } from '../types/mongodb.js';
import type { Recipe } from '../types/express.js';

export class ShoppingListService {
  private static instance: ShoppingListService;
  private constructor() {}

  static getInstance(): ShoppingListService {
    if (!ShoppingListService.instance) {
      ShoppingListService.instance = new ShoppingListService();
    }
    return ShoppingListService.instance;
  }

  async getLists(userId: ObjectId): Promise<ShoppingList[]> {
    try {
      const db = await connectToDatabase();
      const filter: MongoFilter<ShoppingList> = { owner: userId };
      const options: MongoFindOptions<ShoppingList> = { sort: { updatedAt: -1 } };

      return db.collection<ShoppingList>('shopping_lists')
        .find(filter, options)
        .toArray();
    } catch (error) {
      throw new MongoQueryError('Failed to get shopping lists', error);
    }
  }

  async getList(listId: ObjectId, userId: ObjectId): Promise<ShoppingList | null> {
    try {
      if (!isObjectId(listId) || !isObjectId(userId)) {
        throw new ValidationError('Invalid ID format');
      }

      const db = await connectToDatabase();
      const filter: MongoFilter<ShoppingList> = {
        _id: listId,
        $or: [
          { owner: userId },
          { 'collaborators.userId': userId }
        ]
      };

      const list = await db.collection<ShoppingList>('shopping_lists').findOne(filter);
      if (!list && await this.listExists(listId)) {
        throw new ValidationError('Not authorized to access this list');
      }

      return list;
    } catch (error) {
      if (error instanceof ValidationError) throw error;
      throw new MongoQueryError('Failed to get shopping list', error);
    }
  }

  private async listExists(listId: ObjectId): Promise<boolean> {
    try {
      const db = await connectToDatabase();
      const count = await db.collection<ShoppingList>('shopping_lists')
        .countDocuments({ _id: listId });
      return count > 0;
    } catch (error) {
      throw new MongoQueryError('Failed to check list existence', error);
    }
  }

  async createList(userId: ObjectId, data: CreateListDTO): Promise<ShoppingList> {
    try {
      if (!isObjectId(userId)) {
        throw new ValidationError('Invalid user ID format');
      }

      const db = await connectToDatabase();
      const now = new Date();
      
      const list: ShoppingList = {
        _id: new ObjectId(),
        name: data.name,
        items: [],
        owner: userId,
        collaborators: [],
        status: 'active',
        createdAt: now,
        updatedAt: now
      };

      const result = await db.collection<ShoppingList>('shopping_lists').insertOne(list);
      if (!result.acknowledged) {
        throw new MongoWriteError('Failed to create shopping list');
      }

      return list;
    } catch (error) {
      if (error instanceof ValidationError) throw error;
      if (error instanceof MongoWriteError) throw error;
      throw new MongoWriteError('Failed to create shopping list', error);
    }
  }

  async updateList(listId: ObjectId, userId: ObjectId, updates: UpdateListDTO): Promise<ShoppingList> {
    const list = await this.getList(listId, userId);
    if (!list) {
      throw new NotFoundError('Shopping list not found');
    }

    if (list.owner.toString() !== userId.toString() && !list.collaborators.some(c => c.userId.toString() === userId.toString() && c.role === 'editor')) {
      throw new ValidationError('Not authorized to update this list');
    }

    const updateData = {
      ...updates,
      storeId: updates.storeId ? new ObjectId(updates.storeId) : undefined,
      updatedAt: new Date()
    };

    const db = await connectToDatabase();
    const result = await db.collection<ShoppingList>('shopping_lists')
      .findOneAndUpdate(
        { _id: listId },
        { $set: updateData },
        { returnDocument: 'after' }
      );

    if (!result.value) {
      throw new NotFoundError('Shopping list not found');
    }

    return result.value;
  }

  async addItems(listId: ObjectId, userId: ObjectId, items: AddItemDTO[]): Promise<ShoppingList> {
    try {
      const list = await this.getList(listId, userId);
      if (!list) {
        throw new MongoNotFoundError('Shopping list not found');
      }

      if (!this.canEdit(list, userId)) {
        throw new ValidationError('Not authorized to add items to this list');
      }

      const db = await connectToDatabase();
      const now = new Date();

      const newItems: ShoppingListItem[] = items.map(item => ({
        _id: new ObjectId(),
        ingredient: item.ingredient,
        amount: item.amount,
        unit: item.unit,
        checked: false,
        category: item.category,
        notes: item.notes
      }));

      const update: MongoUpdate<ShoppingList> = {
        $push: { items: { $each: newItems } },
        $set: { updatedAt: now }
      };

      const result = await db.collection<ShoppingList>('shopping_lists')
        .findOneAndUpdate(
          { _id: listId },
          update,
          { returnDocument: 'after' }
        );

      if (!result) {
        throw new MongoWriteError('Failed to add items to shopping list');
      }

      const updatedList = result as unknown as ShoppingList;
      if (!isMongoDocument(updatedList)) {
        throw new MongoWriteError('Invalid document returned from database');
      }

      return updatedList;
    } catch (error) {
      if (error instanceof ValidationError) throw error;
      if (error instanceof MongoNotFoundError) throw error;
      if (error instanceof MongoWriteError) throw error;
      throw new MongoWriteError('Failed to add items to shopping list', error);
    }
  }

  private canEdit(list: ShoppingList, userId: ObjectId): boolean {
    return (
      list.owner.toString() === userId.toString() ||
      list.collaborators.some(c => 
        c.userId.toString() === userId.toString() && 
        c.role === 'editor'
      )
    );
  }

  async updateItem(
    listId: ObjectId, 
    userId: ObjectId, 
    itemId: ObjectId, 
    data: UpdateItemDTO
  ): Promise<ShoppingList> {
    try {
      const list = await this.getList(listId, userId);
      if (!list) {
        throw new MongoNotFoundError('Shopping list not found');
      }

      if (!this.canEdit(list, userId)) {
        throw new ValidationError('Not authorized to update items in this list');
      }

      const db = await connectToDatabase();
      const now = new Date();

      const updates: Record<string, any> = {};
      for (const [key, value] of Object.entries(data)) {
        updates[`items.$.${key}`] = value;
      }

      const update: MongoUpdate<ShoppingList> = {
        $set: { ...updates, updatedAt: now }
      };

      const result = await db.collection<ShoppingList>('shopping_lists')
        .findOneAndUpdate(
          {
            _id: listId,
            'items._id': itemId
          },
          update,
          { returnDocument: 'after' }
        );

      if (!result) {
        throw new MongoWriteError('Failed to update shopping list item');
      }

      const updatedList = result as unknown as ShoppingList;
      if (!isMongoDocument(updatedList)) {
        throw new MongoWriteError('Invalid document returned from database');
      }

      return updatedList;
    } catch (error) {
      if (error instanceof ValidationError) throw error;
      if (error instanceof MongoNotFoundError) throw error;
      if (error instanceof MongoWriteError) throw error;
      throw new MongoWriteError('Failed to update shopping list item', error);
    }
  }

  async removeItem(listId: ObjectId, userId: ObjectId, itemId: ObjectId): Promise<ShoppingList> {
    const list = await this.getList(listId, userId);
    if (!list) {
      throw new NotFoundError('Shopping list not found');
    }

    if (list.owner.toString() !== userId.toString() && !list.collaborators.some(c => c.userId.toString() === userId.toString() && c.role === 'editor')) {
      throw new ValidationError('Not authorized to remove items from this list');
    }

    const db = await connectToDatabase();
    const result = await db.collection<ShoppingList>('shopping_lists')
      .findOneAndUpdate(
        { _id: listId },
        {
          $pull: { items: { _id: itemId } },
          $set: { updatedAt: new Date() }
        },
        { returnDocument: 'after' }
      );

    if (!result.value) {
      throw new NotFoundError('Shopping list not found');
    }

    return result.value;
  }

  async deleteList(listId: ObjectId, userId: ObjectId): Promise<void> {
    const list = await this.getList(listId, userId);
    if (!list) {
      throw new NotFoundError('Shopping list not found');
    }

    if (list.owner.toString() !== userId.toString()) {
      throw new ValidationError('Not authorized to delete this list');
    }

    const db = await connectToDatabase();
    await db.collection<ShoppingList>('shopping_lists')
      .deleteOne({ _id: listId });
  }

  async addItemsFromRecipe(
    userId: ObjectId,
    listId: ObjectId,
    data: AddItemsFromRecipeDTO
  ): Promise<ShoppingList> {
    try {
      const db = await connectToDatabase();
      const recipe = await db.collection<Recipe>('recipes')
        .findOne({ _id: new ObjectId(data.recipeId) });
      
      if (!recipe) {
        throw new MongoNotFoundError('Recipe not found');
      }

      const items: AddItemDTO[] = recipe.ingredients
        .filter(ing => !data.excludeItems?.includes(ing.name))
        .map(ing => ({
          ingredient: ing.name,
          amount: ing.amount * (data.servings || 1),
          unit: ing.unit,
          category: 'other' as ItemCategory
        }));

      return this.addItems(listId, userId, items);
    } catch (error) {
      if (error instanceof ValidationError) throw error;
      if (error instanceof MongoNotFoundError) throw error;
      if (error instanceof MongoWriteError) throw error;
      throw new MongoWriteError('Failed to add recipe items to shopping list', error);
    }
  }

  async processVoiceInput(
    userId: ObjectId,
    listId: ObjectId,
    audioBuffer: Buffer
  ): Promise<ShoppingList> {
    const list = await this.getList(listId, userId);
    if (!list) {
      throw new NotFoundError('Shopping list not found');
    }

    // TODO: Implement voice processing logic
    throw new Error('Voice input processing not implemented');
  }

  async deleteItem(userId: ObjectId, listId: ObjectId, itemId: ObjectId): Promise<void> {
    try {
      const list = await this.getList(listId, userId);
      if (!list) {
        throw new MongoNotFoundError('Shopping list not found');
      }

      if (!this.canEdit(list, userId)) {
        throw new ValidationError('Not authorized to delete items from this list');
      }

      const db = await connectToDatabase();
      const now = new Date();

      const update: MongoUpdate<ShoppingList> = {
        $pull: { items: { _id: itemId } },
        $set: { updatedAt: now }
      };

      const result = await db.collection<ShoppingList>('shopping_lists')
        .updateOne({ _id: listId }, update);

      if (result.matchedCount === 0) {
        throw new MongoNotFoundError('Shopping list not found');
      }

      if (result.modifiedCount === 0) {
        throw new MongoWriteError('Failed to delete shopping list item');
      }
    } catch (error) {
      if (error instanceof ValidationError) throw error;
      if (error instanceof MongoNotFoundError) throw error;
      if (error instanceof MongoWriteError) throw error;
      throw new MongoWriteError('Failed to delete shopping list item', error);
    }
  }
}

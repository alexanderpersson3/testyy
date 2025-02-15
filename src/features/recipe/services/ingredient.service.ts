import { ObjectId } from 'mongodb';
import type { WithId } from 'mongodb';
import { DatabaseService } from '../db/database.service.js';
import type { 
  Ingredient, 
  CreateIngredientDTO, 
  UpdateIngredientDTO, 
  IngredientSearchQuery, 
  IngredientStats, 
  IngredientWithPrices, 
  CustomIngredient 
} from '../types/ingredient.js';

type IngredientDocument = WithId<Ingredient>;

export class IngredientService {
  private static instance: IngredientService;
  private db: DatabaseService;
  private readonly COLLECTION = 'ingredients';

  private constructor() {
    this.db = DatabaseService.getInstance();
  }

  public static getInstance(): IngredientService {
    if (!IngredientService.instance) {
      IngredientService.instance = new IngredientService();
    }
    return IngredientService.instance;
  }

  private getCollection() {
    return this.db.getCollection<IngredientDocument>(this.COLLECTION);
  }

  async getIngredientWithPrices(ingredientId: string): Promise<IngredientWithPrices | null> {
    const ingredient = await this.getIngredient(ingredientId);
    if (!ingredient) return null;

    const latestPrice = ingredient.priceHistory?.[0];
    return {
      ...ingredient,
      prices: latestPrice
        ? [
            {
              store: {
                _id: new ObjectId(),
                name: latestPrice.store || 'Unknown Store',
              },
              price: latestPrice.price,
              currency: latestPrice.currency,
              quantity: 1,
              unit: 'unit',
            },
          ]
        : [],
    };
  }

  async createIngredient(userId: string, data: CreateIngredientDTO): Promise<ObjectId> {
    const ingredient: Omit<Ingredient, '_id'> = {
      ...data,
      source: 'user',
      createdBy: new ObjectId(userId),
      isVerified: false,
      status: 'pending',
      tags: data.tags || [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    if (data.price) {
      ingredient.priceHistory = [
        {
          price: data.price.amount,
          currency: data.price.currency,
          store: data.price.store,
          date: new Date(),
        },
      ];
    }

    const result = await this.getCollection().insertOne(ingredient as IngredientDocument);
    return result.insertedId;
  }

  async getIngredient(ingredientId: string): Promise<IngredientDocument | null> {
    return await this.getCollection().findOne({
      _id: new ObjectId(ingredientId),
    });
  }

  async updateIngredient(
    ingredientId: string,
    userId: string,
    data: UpdateIngredientDTO
  ): Promise<void> {
    const ingredient = await this.getIngredient(ingredientId);
    if (!ingredient) {
      throw new Error('Ingredient not found');
    }

    if (ingredient.createdBy?.toString() !== userId) {
      throw new Error('Not authorized to update this ingredient');
    }

    const update: any = {
      $set: {
        ...data,
        updatedAt: new Date(),
      },
    };

    if (data.price) {
      update.$push = {
        priceHistory: {
          price: data.price.amount,
          currency: data.price.currency,
          store: data.price.store,
          date: new Date(),
        },
      };
    }

    await this.getCollection().updateOne(
      { _id: new ObjectId(ingredientId) },
      update
    );
  }

  async deleteIngredient(ingredientId: string, userId: string): Promise<void> {
    const ingredient = await this.getIngredient(ingredientId);
    if (!ingredient) {
      throw new Error('Ingredient not found');
    }

    if (ingredient.createdBy?.toString() !== userId) {
      throw new Error('Not authorized to delete this ingredient');
    }

    await this.getCollection().deleteOne({
      _id: new ObjectId(ingredientId),
    });
  }

  async searchIngredients(query: IngredientSearchQuery): Promise<IngredientDocument[]> {
    const filter: any = {};

    if (query.query) {
      filter.$text = { $search: query.query };
    }

    if (query.category) {
      filter.category = query.category;
    }

    if (query.tags?.length) {
      filter.tags = { $all: query.tags };
    }

    if (query.source) {
      filter.source = query.source;
    }

    if (query.isVerified !== undefined) {
      filter.isVerified = query.isVerified;
    }

    if (query.dietaryPreferences) {
      const { vegan, vegetarian, glutenFree, dairyFree } = query.dietaryPreferences;
      if (vegan) filter['dietaryInfo.isVegan'] = true;
      if (vegetarian) filter['dietaryInfo.isVegetarian'] = true;
      if (glutenFree) filter['dietaryInfo.isGlutenFree'] = true;
      if (dairyFree) filter['dietaryInfo.isDairyFree'] = true;
    }

    if (query.allergenFree?.length) {
      filter.allergens = { $nin: query.allergenFree };
    }

    return await this.getCollection()
      .find(filter)
      .sort({ createdAt: -1 })
      .skip(query.offset || 0)
      .limit(query.limit || 20)
      .toArray();
  }

  async verifyIngredient(ingredientId: string, verifierId: string): Promise<void> {
    await this.getCollection().updateOne(
      { _id: new ObjectId(ingredientId) },
      {
        $set: {
          isVerified: true,
          status: 'approved',
          verifiedBy: new ObjectId(verifierId),
          verifiedAt: new Date(),
          updatedAt: new Date(),
        },
      }
    );
  }

  async rejectIngredient(ingredientId: string, verifierId: string): Promise<void> {
    await this.getCollection().updateOne(
      { _id: new ObjectId(ingredientId) },
      {
        $set: {
          status: 'rejected',
          verifiedBy: new ObjectId(verifierId),
          verifiedAt: new Date(),
          updatedAt: new Date(),
        },
      }
    );
  }

  async getStats(): Promise<IngredientStats> {
    const [
      totalIngredients,
      userSubmitted,
      verified,
      pendingVerification,
      categoryCounts,
      sourceCounts,
    ] = await Promise.all([
      this.getCollection().countDocuments(),
      this.getCollection().countDocuments({ source: 'user' }),
      this.getCollection().countDocuments({ isVerified: true }),
      this.getCollection().countDocuments({ status: 'pending' }),
      this.getCollection()
        .aggregate([{ $group: { _id: '$category', count: { $sum: 1 } } }])
        .toArray(),
      this.getCollection()
        .aggregate([{ $group: { _id: '$source', count: { $sum: 1 } } }])
        .toArray(),
    ]);

    return {
      totalIngredients,
      userSubmitted,
      verified,
      pendingVerification,
      byCategory: Object.fromEntries(
        categoryCounts.map(({ _id, count }) => [_id || 'uncategorized', count])
      ),
      bySource: Object.fromEntries(sourceCounts.map(({ _id, count }) => [_id, count])) as Record<
        'matspar' | 'user' | 'system',
        number
      >,
    };
  }

  async createCustomIngredient(data: CustomIngredient): Promise<ObjectId> {
    const ingredient: Omit<Ingredient, '_id'> = {
      ...data,
      source: 'user',
      isVerified: false,
      status: data.status || 'pending',
      priceHistory: data.customPrice ? [{
        price: data.customPrice,
        currency: 'SEK',
        store: data.store,
        date: new Date()
      }] : [],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await this.getCollection().insertOne(ingredient as IngredientDocument);
    return result.insertedId;
  }

  async getUserCustomIngredients(userId: string): Promise<IngredientDocument[]> {
    return await this.getCollection()
      .find({
        userId: new ObjectId(userId),
        isCustom: true,
      })
      .toArray();
  }

  async getCustomIngredient(ingredientId: string, userId: string): Promise<IngredientDocument | null> {
    return await this.getCollection().findOne({
      _id: new ObjectId(ingredientId),
      userId: new ObjectId(userId),
      isCustom: true,
    });
  }

  async updateCustomIngredient(
    ingredientId: string,
    userId: string,
    data: Partial<CustomIngredient>
  ): Promise<void> {
    const result = await this.getCollection().updateOne(
      {
        _id: new ObjectId(ingredientId),
        userId: new ObjectId(userId),
        isCustom: true,
      },
      { $set: data }
    );

    if (result.matchedCount === 0) {
      throw new Error('Custom ingredient not found');
    }
  }

  async deleteCustomIngredient(ingredientId: string, userId: string): Promise<boolean> {
    const result = await this.getCollection().deleteOne({
      _id: new ObjectId(ingredientId),
      userId: new ObjectId(userId),
      isCustom: true,
    });

    return result.deletedCount > 0;
  }
}

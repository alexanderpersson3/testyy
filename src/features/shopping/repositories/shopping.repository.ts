import { Collection, ObjectId } from 'mongodb';
import { DatabaseService } from '../../../core/database/database.service';
import type {
  ShoppingList,
  Store,
  StoreDeal,
  StoreProduct,
  ShoppingListSearchParams,
  StoreSearchParams,
  ShoppingListStats
} from '../types/shopping.types';
import { MongoNotFoundError, MongoQueryError } from '../../../core/errors/mongodb.errors';

export class ShoppingRepository {
  private static instance: ShoppingRepository;
  private initialized: boolean = false;
  private db: DatabaseService;
  private shoppingListsCollection!: Collection<ShoppingList>;
  private storesCollection!: Collection<Store>;
  private storeDealsCollection!: Collection<StoreDeal>;
  private storeProductsCollection!: Collection<StoreProduct>;

  private constructor() {
    this.db = DatabaseService.getInstance();
    this.initialize().catch(error => {
      console.error('Failed to initialize ShoppingRepository:', error);
    });
  }

  public static getInstance(): ShoppingRepository {
    if (!ShoppingRepository.instance) {
      ShoppingRepository.instance = new ShoppingRepository();
    }
    return ShoppingRepository.instance;
  }

  private async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      await this.db.connect();
      this.shoppingListsCollection = this.db.getCollection<ShoppingList>('shopping_lists');
      this.storesCollection = this.db.getCollection<Store>('stores');
      this.storeDealsCollection = this.db.getCollection<StoreDeal>('store_deals');
      this.storeProductsCollection = this.db.getCollection<StoreProduct>('store_products');
      this.initialized = true;
    } catch (error) {
      throw new MongoQueryError('Failed to initialize ShoppingRepository', error);
    }
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  // Shopping List Operations
  async createShoppingList(list: Omit<ShoppingList, '_id'>): Promise<ShoppingList> {
    await this.ensureInitialized();
    const result = await this.shoppingListsCollection.insertOne({
      ...list,
      lastModified: new Date(),
    } as ShoppingList);
    
    return this.getShoppingList(result.insertedId);
  }

  async getShoppingList(listId: ObjectId): Promise<ShoppingList> {
    await this.ensureInitialized();
    const list = await this.shoppingListsCollection.findOne({ _id: listId });
    
    if (!list) {
      throw new MongoNotFoundError('Shopping list not found');
    }
    
    return list;
  }

  async updateShoppingList(listId: ObjectId, update: Partial<ShoppingList>): Promise<ShoppingList> {
    await this.ensureInitialized();
    const result = await this.shoppingListsCollection.findOneAndUpdate(
      { _id: listId },
      {
        $set: {
          ...update,
          lastModified: new Date(),
        },
      },
      { returnDocument: 'after' }
    );

    if (!result.value) {
      throw new MongoNotFoundError('Shopping list not found');
    }

    return result.value;
  }

  async deleteShoppingList(listId: ObjectId): Promise<boolean> {
    await this.ensureInitialized();
    const result = await this.shoppingListsCollection.deleteOne({ _id: listId });
    return result.deletedCount > 0;
  }

  async searchShoppingLists(params: ShoppingListSearchParams): Promise<ShoppingList[]> {
    await this.ensureInitialized();
    const query: any = {};

    if (params.userId) query.userId = params.userId;
    if (params.status) query.status = params.status;
    if (params.isDefault !== undefined) query.isDefault = params.isDefault;
    if (params.sharedWith) query.sharedWith = params.sharedWith;
    if (params.fromDate || params.toDate) {
      query.lastModified = {};
      if (params.fromDate) query.lastModified.$gte = params.fromDate;
      if (params.toDate) query.lastModified.$lte = params.toDate;
    }

    return this.shoppingListsCollection
      .find(query)
      .sort({ [params.sortBy || 'lastModified']: -1 })
      .skip(params.offset || 0)
      .limit(params.limit || 20)
      .toArray();
  }

  // Store Operations
  async createStore(store: Omit<Store, '_id'>): Promise<Store> {
    await this.ensureInitialized();
    const result = await this.storesCollection.insertOne(store as Store);
    return this.getStore(result.insertedId);
  }

  async getStore(storeId: ObjectId): Promise<Store> {
    await this.ensureInitialized();
    const store = await this.storesCollection.findOne({ _id: storeId });
    
    if (!store) {
      throw new MongoNotFoundError('Store not found');
    }
    
    return store;
  }

  async updateStore(storeId: ObjectId, update: Partial<Store>): Promise<Store> {
    await this.ensureInitialized();
    const result = await this.storesCollection.findOneAndUpdate(
      { _id: storeId },
      { $set: update },
      { returnDocument: 'after' }
    );

    if (!result.value) {
      throw new MongoNotFoundError('Store not found');
    }

    return result.value;
  }

  async searchStores(params: StoreSearchParams): Promise<Store[]> {
    await this.ensureInitialized();
    const query: any = {};

    if (params.query) {
      query.$or = [
        { name: new RegExp(params.query, 'i') },
        { 'location.city': new RegExp(params.query, 'i') },
      ];
    }
    if (params.city) query['location.city'] = new RegExp(params.city, 'i');
    if (params.postalCode) query['location.postalCode'] = params.postalCode;
    if (params.features?.length) query.features = { $all: params.features };
    if (params.isActive !== undefined) query.isActive = params.isActive;

    if (params.coordinates && params.radius) {
      query['location.coordinates'] = {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [params.coordinates.longitude, params.coordinates.latitude],
          },
          $maxDistance: params.radius * 1000, // Convert km to meters
        },
      };
    }

    return this.storesCollection
      .find(query)
      .sort({ [params.sortBy || 'name']: 1 })
      .skip(params.offset || 0)
      .limit(params.limit || 20)
      .toArray();
  }

  // Store Deals Operations
  async getStoreDeals(storeId: ObjectId): Promise<StoreDeal[]> {
    await this.ensureInitialized();
    return this.storeDealsCollection
      .find({
        storeId,
        isActive: true,
        endDate: { $gt: new Date() },
      })
      .sort({ startDate: 1 })
      .toArray();
  }

  // Store Products Operations
  async getStoreProducts(storeId: ObjectId, category?: string): Promise<StoreProduct[]> {
    await this.ensureInitialized();
    const query: any = { storeId, inStock: true };
    if (category) query.category = category;

    return this.storeProductsCollection
      .find(query)
      .sort({ name: 1 })
      .toArray();
  }

  // Statistics
  async getShoppingListStats(userId: ObjectId): Promise<ShoppingListStats> {
    await this.ensureInitialized();
    const pipeline = [
      { $match: { userId } },
      {
        $facet: {
          counts: [
            {
              $group: {
                _id: '$status',
                count: { $sum: 1 },
              },
            },
          ],
          itemStats: [
            { $unwind: '$items' },
            {
              $group: {
                _id: '$items.name',
                count: { $sum: 1 },
                totalLists: { $addToSet: '$_id' },
              },
            },
            { $sort: { count: -1 } },
            { $limit: 10 },
          ],
        },
      },
    ];

    const [result] = await this.shoppingListsCollection.aggregate(pipeline).toArray();
    const statusCounts = result.counts.reduce((acc: any, curr: any) => {
      acc[curr._id] = curr.count;
      return acc;
    }, {});

    return {
      totalLists: Object.values(statusCounts).reduce((a: number, b: number) => a + b, 0),
      activeLists: statusCounts.active || 0,
      completedLists: statusCounts.completed || 0,
      archivedLists: statusCounts.archived || 0,
      averageItemsPerList: result.itemStats.reduce((acc: number, curr: any) => acc + curr.count, 0) / result.itemStats.length,
      mostCommonItems: result.itemStats.map((item: any) => ({
        name: item._id,
        count: item.count,
      })),
    };
  }
} 
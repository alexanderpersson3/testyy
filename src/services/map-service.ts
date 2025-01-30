import { Collection, ObjectId } from 'mongodb';
import { getDb } from '../config/db';

interface Coordinates {
  latitude: number;
  longitude: number;
}

interface Store {
  _id?: ObjectId;
  name: string;
  location: {
    coordinates: [number, number]; // [longitude, latitude]
    address: string;
    city: string;
    state: string;
    country: string;
    postalCode: string;
  };
  type: 'supermarket' | 'specialty' | 'farmers_market' | 'convenience';
  operatingHours: {
    [key: string]: { // day of week
      open: string;
      close: string;
    };
  };
  contact: {
    phone?: string;
    email?: string;
    website?: string;
  };
  features: {
    hasParking: boolean;
    isWheelchairAccessible: boolean;
    acceptsCreditCards: boolean;
    hasDelivery: boolean;
  };
  averageWaitTime?: number; // in minutes
  rating?: {
    average: number;
    count: number;
  };
  deals?: Array<{
    productId: ObjectId;
    discount: number;
    startDate: Date;
    endDate: Date;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

interface StoreProduct {
  _id?: ObjectId;
  storeId: ObjectId;
  name: string;
  category: string;
  price: number;
  unit: string;
  inStock: boolean;
  recipeIngredients?: ObjectId[]; // References to recipe ingredients
  updatedAt: Date;
}

interface SearchOptions {
  maxDistance?: number; // in meters
  storeType?: Store['type'];
  hasDeals?: boolean;
  isOpen?: boolean;
  maxWaitTime?: number;
}

export class MapService {
  private static instance: MapService;
  private storesCollection!: Collection<Store>;
  private productsCollection!: Collection<StoreProduct>;
  private initialized = false;

  private constructor() {
    this.initializeCollections().catch(error => {
      console.error('Failed to initialize map service:', error);
    });
  }

  public static getInstance(): MapService {
    if (!MapService.instance) {
      MapService.instance = new MapService();
    }
    return MapService.instance;
  }

  private async initializeCollections() {
    if (this.initialized) return;

    const db = await getDb();
    this.storesCollection = db.collection<Store>('stores');
    this.productsCollection = db.collection<StoreProduct>('store_products');

    // Create geospatial index
    await this.storesCollection.createIndex({ 'location.coordinates': '2dsphere' });
    // Create index for store products
    await this.productsCollection.createIndex({ storeId: 1, category: 1 });
    await this.productsCollection.createIndex({ recipeIngredients: 1 });

    this.initialized = true;
  }

  private async ensureInitialized() {
    if (!this.initialized) {
      await this.initializeCollections();
    }
  }

  async findNearbyStores(
    coordinates: Coordinates,
    options: SearchOptions = {}
  ): Promise<Store[]> {
    await this.ensureInitialized();

    const {
      maxDistance = 5000, // 5km default
      storeType,
      hasDeals,
      isOpen,
      maxWaitTime
    } = options;

    const query: any = {
      'location.coordinates': {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [coordinates.longitude, coordinates.latitude]
          },
          $maxDistance: maxDistance
        }
      }
    };

    if (storeType) {
      query.type = storeType;
    }

    if (hasDeals) {
      query['deals.endDate'] = { $gt: new Date() };
    }

    if (maxWaitTime) {
      query.averageWaitTime = { $lte: maxWaitTime };
    }

    if (isOpen) {
      const now = new Date();
      const dayOfWeek = now.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
      const currentTime = now.toLocaleTimeString('en-US', { hour12: false });
      
      query[`operatingHours.${dayOfWeek}.open`] = { $lte: currentTime };
      query[`operatingHours.${dayOfWeek}.close`] = { $gt: currentTime };
    }

    return await this.storesCollection.find(query).toArray();
  }

  async findStoresForRecipe(
    recipeId: string,
    coordinates: Coordinates
  ): Promise<Array<{
    store: Store;
    availableIngredients: number;
    totalIngredients: number;
    deals: Array<{
      ingredient: string;
      discount: number;
    }>;
  }>> {
    await this.ensureInitialized();

    const db = await getDb();
    const recipe = await db.collection('recipes').findOne({
      _id: new ObjectId(recipeId)
    });

    if (!recipe) {
      throw new Error('Recipe not found');
    }

    const ingredientIds = recipe.ingredients.map((i: any) => new ObjectId(i._id));
    const nearbyStores = await this.findNearbyStores(coordinates);

    const results = await Promise.all(
      nearbyStores.map(async store => {
        const products = await this.productsCollection.find({
          storeId: store._id,
          recipeIngredients: { $in: ingredientIds },
          inStock: true
        }).toArray();

        const deals = store.deals?.filter(deal => 
          products.some(product => product._id?.equals(deal.productId))
        ) || [];

        return {
          store,
          availableIngredients: products.length,
          totalIngredients: ingredientIds.length,
          deals: deals.map(deal => {
            const product = products.find(p => p._id?.equals(deal.productId));
            return {
              ingredient: product?.name || '',
              discount: deal.discount
            };
          })
        };
      })
    );

    // Sort by number of available ingredients and deals
    return results.sort((a, b) => {
      if (a.availableIngredients !== b.availableIngredients) {
        return b.availableIngredients - a.availableIngredients;
      }
      return (b.deals?.length || 0) - (a.deals?.length || 0);
    });
  }

  async getStoreBestDeals(storeId: string): Promise<Array<{
    product: StoreProduct;
    discount: number;
    originalPrice: number;
    discountedPrice: number;
  }>> {
    await this.ensureInitialized();

    const store = await this.storesCollection.findOne({
      _id: new ObjectId(storeId)
    });

    if (!store || !store.deals) {
      return [];
    }

    const activeDeals = store.deals.filter(deal => 
      deal.endDate > new Date()
    );

    const products = await this.productsCollection.find({
      _id: { $in: activeDeals.map(deal => deal.productId) }
    }).toArray();

    return activeDeals.map(deal => {
      const product = products.find(p => p._id?.equals(deal.productId));
      if (!product) return null;

      return {
        product,
        discount: deal.discount,
        originalPrice: product.price,
        discountedPrice: product.price * (1 - deal.discount / 100)
      };
    }).filter(Boolean) as Array<{
      product: StoreProduct;
      discount: number;
      originalPrice: number;
      discountedPrice: number;
    }>;
  }

  async updateStoreWaitTime(storeId: string, waitTime: number): Promise<void> {
    await this.ensureInitialized();

    await this.storesCollection.updateOne(
      { _id: new ObjectId(storeId) },
      {
        $push: {
          waitTimeSamples: {
            time: waitTime,
            timestamp: new Date()
          }
        },
        $set: {
          averageWaitTime: waitTime, // You might want to calculate a rolling average
          updatedAt: new Date()
        }
      }
    );
  }

  async addStoreDeal(
    storeId: string,
    productId: string,
    discount: number,
    startDate: Date,
    endDate: Date
  ): Promise<void> {
    await this.ensureInitialized();

    await this.storesCollection.updateOne(
      { _id: new ObjectId(storeId) },
      {
        $push: {
          deals: {
            productId: new ObjectId(productId),
            discount,
            startDate,
            endDate
          }
        },
        $set: { updatedAt: new Date() }
      }
    );
  }
} 
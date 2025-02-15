;
;
import type { Collection } from 'mongodb';
import type { ObjectId } from '../types/express.js';
import { Store, StoreProduct, Product, StoreDeal, StoreWithDistance } from '../types/store.js';;
import type { Recipe } from '../types/express.js';
import logger from '../utils/logger.js';
import { DatabaseError, NotFoundError } from '../utils/errors.js';;
import { DatabaseService } from '../db/database.service.js';;

interface GeoNearQuery {
  $near: {
    $geometry: {
      type: 'Point';
      coordinates: [number, number];
    };
    $maxDistance: number;
  };
}

interface AggregateStage {
  $match?: { [key: string]: unknown };
  $lookup?: {
    from: string;
    localField: string;
    foreignField: string;
    as: string;
  };
  $unwind?: string;
  $limit?: number;
  $geoNear?: {
    near: {
      type: 'Point';
      coordinates: [number, number];
    };
    distanceField: string;
    maxDistance?: number;
    spherical: boolean;
  };
}

interface StoreProductWithStore extends Omit<StoreProduct, 'store'> {
  store: Store;
}

interface StoreProductUpdate {
  productId: ObjectId;
  inStock: boolean;
  price?: number;
  quantity?: number;
}

export interface MapServiceInterface {
  findNearbyStores(
    latitude: number,
    longitude: number,
    options?: {
      maxDistance?: number;
      limit?: number;
      filterByProducts?: ObjectId[];
    }
  ): Promise<StoreWithDistance[]>;

  getStoreDeals(storeId: ObjectId): Promise<StoreDeal[]>;

  getStoreProducts(storeId: ObjectId): Promise<StoreProduct[]>;

  updateProductAvailability(storeId: ObjectId, updates: StoreProductUpdate[]): Promise<void>;

  getProductAvailability(
    productId: ObjectId,
    options?: {
      latitude?: number;
      longitude?: number;
      maxDistance?: number;
      limit?: number;
    }
  ): Promise<StoreProductWithStore[]>;
}

export class MapService implements MapServiceInterface {
  private static instance: MapService;
  private db: DatabaseService;
  private initialized: boolean = false;
  private storesCollection!: Collection<Store>;
  private productsCollection!: Collection<StoreProduct>;
  private recipesCollection!: Collection<Recipe>;

  private constructor() {
    this.db = DatabaseService.getInstance();
    this.initialize().catch(error => {
      logger.error('Failed to initialize MapService:', error);
    });
  }

  private async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      await this.db.connect();
      this.storesCollection = this.db.getCollection<Store>('stores');
      this.productsCollection = this.db.getCollection<StoreProduct>('store_products');
      this.recipesCollection = this.db.getCollection<Recipe>('recipes');

      // Create geospatial index for store locations
      await this.storesCollection.createIndex({ location: '2dsphere' });

      this.initialized = true;
      logger.info('MapService initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize MapService:', error);
      throw error;
    }
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  public static getInstance(): MapService {
    if (!MapService.instance) {
      MapService.instance = new MapService();
    }
    return MapService.instance;
  }

  public async findNearbyStores(
    latitude: number,
    longitude: number,
    options: {
      maxDistance?: number;
      limit?: number;
      filterByProducts?: ObjectId[];
    } = {}
  ): Promise<StoreWithDistance[]> {
    await this.ensureInitialized();

    const maxDistance = options.maxDistance || 10000; // 10km default
    const limit = options.limit || 20;

    try {
      const query: { location: GeoNearQuery; _id?: { $in: ObjectId[] } } = {
        location: {
          $near: {
            $geometry: {
              type: 'Point',
              coordinates: [longitude, latitude],
            },
            $maxDistance: maxDistance,
          },
        },
      };

      if (options.filterByProducts?.length) {
        const availableStores = await this.productsCollection.distinct('storeId', {
          productId: { $in: options.filterByProducts },
          inStock: true,
        });
        query._id = { $in: availableStores };
      }

      const stores = await this.storesCollection.find(query).limit(limit).toArray();

      return stores.map(store => ({
        ...store,
        distance: this.calculateDistance(
          latitude,
          longitude,
          store.location.coordinates[1],
          store.location.coordinates[0]
        ),
        currentDeals: store.deals?.length || 0,
      }));
    } catch (error) {
      logger.error('Failed to find nearby stores:', error);
      throw new DatabaseError('Failed to find nearby stores');
    }
  }

  public async getStoreDeals(storeId: ObjectId): Promise<StoreDeal[]> {
    await this.ensureInitialized();

    try {
      const store = await this.storesCollection.findOne({ _id: storeId });
      if (!store) {
        throw new NotFoundError('Store not found');
      }

      return store.deals || [];
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      logger.error('Failed to get store deals:', error);
      throw new DatabaseError('Failed to get store deals');
    }
  }

  public async updateProductAvailability(
    storeId: ObjectId,
    updates: StoreProductUpdate[]
  ): Promise<void> {
    await this.ensureInitialized();

    try {
      const operations = updates.map(update => ({
        updateOne: {
          filter: {
            storeId,
            productId: update.productId,
          },
          update: {
            $set: {
              inStock: update.inStock,
              ...(update.price !== undefined && { price: update.price }),
              ...(update.quantity !== undefined && { quantity: update.quantity }),
              updatedAt: new Date(),
            },
          },
          upsert: true,
        },
      }));

      await this.productsCollection.bulkWrite(operations);
    } catch (error) {
      logger.error('Failed to update product availability:', error);
      throw new DatabaseError('Failed to update product availability');
    }
  }

  public async getProductAvailability(
    productId: ObjectId,
    options: {
      latitude?: number;
      longitude?: number;
      maxDistance?: number;
      limit?: number;
    } = {}
  ): Promise<StoreProductWithStore[]> {
    await this.ensureInitialized();

    try {
      const pipeline: AggregateStage[] = [{ $match: { productId } }];

      if (options.latitude && options.longitude) {
        pipeline.push({
          $lookup: {
            from: 'stores',
            localField: 'storeId',
            foreignField: '_id',
            as: 'store',
          },
        });
        pipeline.push({ $unwind: '$store' });

        if (options.maxDistance) {
          pipeline.push({
            $match: {
              'store.location': {
                $near: {
                  $geometry: {
                    type: 'Point',
                    coordinates: [options.longitude, options.latitude],
                  },
                  $maxDistance: options.maxDistance,
                },
              },
            },
          });
        }
      } else {
        pipeline.push({
          $lookup: {
            from: 'stores',
            localField: 'storeId',
            foreignField: '_id',
            as: 'store',
          },
        });
        pipeline.push({ $unwind: '$store' });
      }

      if (options.limit) {
        pipeline.push({ $limit: options.limit });
      }

      const results = await this.productsCollection
        .aggregate<StoreProductWithStore>(pipeline)
        .toArray();

      return results;
    } catch (error) {
      logger.error('Failed to get product availability:', error);
      throw new DatabaseError('Failed to get product availability');
    }
  }

  public async getStoreProducts(storeId: ObjectId): Promise<StoreProduct[]> {
    await this.ensureInitialized();

    try {
      return await this.productsCollection.find({ storeId }).toArray();
    } catch (error) {
      logger.error('Failed to get store products:', error);
      throw new DatabaseError('Failed to get store products');
    }
  }

  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth's radius in km
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) *
        Math.cos(this.toRad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  private async processStoreProducts(
    store: Store,
    products: StoreProduct[]
  ): Promise<StoreProductWithStore[]> {
    return products.map(product => ({
      ...product,
      store: {
        _id: store._id!,
        name: store.name,
        type: store.type,
        location: store.location,
        address: store.address,
        openingHours: store.openingHours,
        createdAt: store.createdAt,
        updatedAt: store.updatedAt,
      },
    }));
  }
}

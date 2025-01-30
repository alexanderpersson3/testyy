import { Collection, ObjectId } from 'mongodb';

export interface Store {
  _id?: ObjectId;
  name: string;
  type: 'grocery' | 'pharmacy' | 'specialty';
  location: {
    address: string;
    city: string;
    coordinates: [number, number]; // [longitude, latitude]
  };
  openingHours: {
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
  isAffiliate: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Product {
  _id?: ObjectId;
  storeId: ObjectId;
  name: string;
  category: string;
  subcategory?: string;
  brand?: string;
  description?: string;
  price: number;
  unit: string;
  inStock: boolean;
  isOrganic: boolean;
  allergens?: string[];
  nutritionalInfo?: {
    calories?: number;
    protein?: number;
    carbs?: number;
    fat?: number;
    fiber?: number;
  };
  relatedProducts?: ObjectId[];
  popularity: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Deal {
  _id?: ObjectId;
  storeId: ObjectId;
  productId: ObjectId;
  type: 'discount' | 'bogo' | 'bundle';
  description: string;
  discountPercentage?: number;
  startDate: Date;
  endDate: Date;
  conditions?: string;
  createdAt: Date;
  updatedAt: Date;
}

export class StoreService {
  constructor(
    private storesCollection: Collection<Store>,
    private productsCollection: Collection<Product>,
    private dealsCollection: Collection<Deal>
  ) {}

  // Store operations
  async getNearbyStores(
    coordinates: [number, number],
    maxDistance: number = 10000, // 10km
    type?: Store['type']
  ): Promise<Store[]> {
    const query: any = {
      'location.coordinates': {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: coordinates
          },
          $maxDistance: maxDistance
        }
      }
    };

    if (type) {
      query.type = type;
    }

    return this.storesCollection.find(query).toArray();
  }

  async getStoresByWaitTime(maxWaitTime?: number): Promise<Store[]> {
    const query = maxWaitTime 
      ? { averageWaitTime: { $lte: maxWaitTime } }
      : {};

    return this.storesCollection
      .find(query)
      .sort({ averageWaitTime: 1 })
      .toArray();
  }

  async getStoresWithDeals(): Promise<Store[]> {
    const storesWithDeals = await this.dealsCollection.distinct('storeId');
    return this.storesCollection
      .find({ _id: { $in: storesWithDeals } })
      .toArray();
  }

  // Product operations
  async getProducts(
    storeId: ObjectId,
    category?: string,
    inStockOnly: boolean = false,
    page: number = 1,
    limit: number = 20
  ): Promise<{ products: Product[]; total: number }> {
    const query: any = { storeId };
    
    if (category) {
      query.category = category;
    }
    if (inStockOnly) {
      query.inStock = true;
    }

    const [products, total] = await Promise.all([
      this.productsCollection
        .find(query)
        .skip((page - 1) * limit)
        .limit(limit)
        .toArray(),
      this.productsCollection.countDocuments(query)
    ]);

    return { products, total };
  }

  async getRelatedProducts(productId: ObjectId): Promise<Product[]> {
    const product = await this.productsCollection.findOne({ _id: productId });
    if (!product || !product.relatedProducts) {
      return [];
    }

    return this.productsCollection
      .find({ _id: { $in: product.relatedProducts } })
      .toArray();
  }

  async getProductDeals(productId: ObjectId): Promise<Deal[]> {
    const currentDate = new Date();
    return this.dealsCollection
      .find({
        productId,
        startDate: { $lte: currentDate },
        endDate: { $gt: currentDate }
      })
      .toArray();
  }

  // Category operations
  async getCategories(storeId: ObjectId): Promise<string[]> {
    return this.productsCollection.distinct('category', { storeId });
  }

  async getSubcategories(storeId: ObjectId, category: string): Promise<string[]> {
    const subcategories = await this.productsCollection.distinct('subcategory', { 
      storeId,
      category,
      subcategory: { $type: 'string' }
    });
    return subcategories.filter((sub): sub is string => typeof sub === 'string');
  }

  // Deal operations
  async getCurrentDeals(
    storeId: ObjectId,
    page: number = 1,
    limit: number = 20
  ): Promise<{ deals: Deal[]; total: number }> {
    const currentDate = new Date();
    const query = {
      storeId,
      startDate: { $lte: currentDate },
      endDate: { $gt: currentDate }
    };

    const [deals, total] = await Promise.all([
      this.dealsCollection
        .find(query)
        .skip((page - 1) * limit)
        .limit(limit)
        .toArray(),
      this.dealsCollection.countDocuments(query)
    ]);

    return { deals, total };
  }

  async getBestDeals(limit: number = 10): Promise<Deal[]> {
    const currentDate = new Date();
    return this.dealsCollection
      .find({
        startDate: { $lte: currentDate },
        endDate: { $gt: currentDate },
        discountPercentage: { $exists: true }
      })
      .sort({ discountPercentage: -1 })
      .limit(limit)
      .toArray();
  }
} 

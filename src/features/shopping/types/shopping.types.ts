import { ObjectId } from 'mongodb';
import type { MongoDocument } from '../../../core/database/types/mongodb.types';

export interface ShoppingList extends MongoDocument {
  userId: ObjectId;
  name: string;
  items: ShoppingItem[];
  recipeId?: ObjectId;
  isDefault: boolean;
  lastModified: Date;
  status: 'active' | 'completed' | 'archived';
  sharedWith?: ObjectId[];
}

export interface ShoppingItem {
  ingredientId: ObjectId;
  name: string;
  quantity: number;
  unit: string;
  category?: string;
  checked: boolean;
  addedAt: Date;
  notes?: string;
  price?: {
    amount: number;
    currency: string;
    storeId?: ObjectId;
  };
}

export interface Store extends MongoDocument {
  name: string;
  location: {
    address: string;
    city: string;
    state: string;
    country: string;
    postalCode: string;
    coordinates?: {
      latitude: number;
      longitude: number;
    };
  };
  operatingHours: {
    [key: string]: {
      open: string;
      close: string;
    };
  };
  contact: {
    phone?: string;
    email?: string;
    website?: string;
  };
  ratings: {
    average: number;
    count: number;
  };
  features: string[];
  isActive: boolean;
}

export interface StoreDeal extends MongoDocument {
  storeId: ObjectId;
  title: string;
  description: string;
  startDate: Date;
  endDate: Date;
  items: {
    productId: ObjectId;
    name: string;
    originalPrice: number;
    discountedPrice: number;
    discountPercentage: number;
  }[];
  conditions?: string[];
  isActive: boolean;
}

export interface StoreProduct extends MongoDocument {
  storeId: ObjectId;
  name: string;
  description?: string;
  category: string;
  brand?: string;
  price: {
    amount: number;
    currency: string;
  };
  unit: string;
  inStock: boolean;
  nutritionInfo?: {
    [key: string]: number;
  };
  allergens?: string[];
  barcode?: string;
}

export interface ShoppingListStats {
  totalLists: number;
  activeLists: number;
  completedLists: number;
  archivedLists: number;
  averageItemsPerList: number;
  mostCommonItems: Array<{
    name: string;
    count: number;
  }>;
}

export type CreateShoppingListDTO = Omit<ShoppingList, keyof MongoDocument | 'lastModified'>;
export type UpdateShoppingListDTO = Partial<CreateShoppingListDTO>;

export type CreateStoreDTO = Omit<Store, keyof MongoDocument>;
export type UpdateStoreDTO = Partial<CreateStoreDTO>;

export type CreateStoreDealDTO = Omit<StoreDeal, keyof MongoDocument>;
export type UpdateStoreDealDTO = Partial<CreateStoreDealDTO>;

export interface ShoppingListSearchParams {
  userId?: ObjectId;
  status?: ShoppingList['status'];
  isDefault?: boolean;
  sharedWith?: ObjectId;
  fromDate?: Date;
  toDate?: Date;
  sortBy?: string;
  limit?: number;
  offset?: number;
}

export interface StoreSearchParams {
  query?: string;
  city?: string;
  postalCode?: string;
  features?: string[];
  isActive?: boolean;
  radius?: number;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
  sortBy?: string;
  limit?: number;
  offset?: number;
} 
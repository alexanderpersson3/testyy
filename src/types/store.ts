import { ObjectId } from 'mongodb';

export interface Store {
  _id?: ObjectId;
  name: string;
  latitude: number;
  longitude: number;
  storeType: StoreType;
  address: {
    street: string;
    city: string;
    postalCode: string;
    country: string;
  };
  openingHours: {
    [key in WeekDay]: OpeningHours;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface StoreWithDistance extends Store {
  distance: number; // in kilometers
  currentDeals: number;
}

export type StoreType = 'supermarket' | 'convenience' | 'wholesale' | 'specialty';
export type WeekDay = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

export interface OpeningHours {
  open: string; // HH:mm format
  close: string; // HH:mm format
  closed: boolean;
}

export interface NearbyStoresQuery {
  latitude: number;
  longitude: number;
  radius?: number; // in kilometers, default 10
  limit?: number;
  offset?: number;
  sortBy?: 'distance' | 'bestDeals';
  storeType?: StoreType[];
}

export interface ProductCategory {
  _id: ObjectId;
  storeId: ObjectId;
  name: string;
  description?: string;
  parentId?: ObjectId; // For subcategories
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Product {
  _id: ObjectId;
  storeId: ObjectId;
  categoryId: ObjectId;
  name: string;
  description?: string;
  brand?: string;
  price: number;
  unit: string;
  quantity: number;
  barcode?: string;
  imageUrl?: string;
  inStock: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Promotion {
  _id: ObjectId;
  storeId: ObjectId;
  productId: ObjectId;
  type: 'discount' | 'bogo' | 'bundle';
  description: string;
  discountPercent?: number;
  discountAmount?: number;
  startDate: Date;
  endDate: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface Flyer {
  _id: ObjectId;
  storeId: ObjectId;
  title: string;
  description?: string;
  pdfUrl: string;
  startDate: Date;
  endDate: Date;
  createdAt: Date;
  updatedAt: Date;
} 
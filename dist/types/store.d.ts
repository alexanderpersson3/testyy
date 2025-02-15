import { ObjectId } from 'mongodb';
import type { BaseDocument } from '../types/index.js';
export interface Store {
    _id?: ObjectId;
    name: string;
    type: 'grocery' | 'pharmacy' | 'specialty';
    location: {
        type: string;
        coordinates: [number, number];
    };
    address: string;
    openingHours: {
        [key: string]: {
            open: string;
            close: string;
        };
    };
    waitTimeSamples?: Array<{
        time: number;
        timestamp: Date;
    }>;
    averageWaitTime?: number;
    deals?: StoreDeal[];
    createdAt?: Date;
    updatedAt?: Date;
}
export interface Product extends BaseDocument {
    storeId: ObjectId;
    categoryId: ObjectId;
    name: string;
    description?: string;
    price: number;
    unit: string;
    quantity: number;
    inStock: boolean;
    brand?: string;
    images?: string[];
    attributes?: Record<string, any>;
    tags?: string[];
}
export interface StoreProduct {
    _id?: ObjectId;
    storeId: ObjectId;
    productId: ObjectId;
    name: string;
    inStock: boolean;
    price?: number;
    quantity?: number;
    unit: string;
    updatedAt: Date;
}
export interface StoreDeal {
    productId: ObjectId;
    discount: number;
    startDate: Date;
    endDate: Date;
}
export interface StoreWithDistance extends Store {
    distance: number;
    currentDeals: number;
}
export type StoreType = 'grocery' | 'pharmacy' | 'specialty';
export type WeekDay = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
export interface OpeningHours {
    open: string;
    close: string;
    closed: boolean;
}
export interface NearbyStoresQuery {
    latitude: number;
    longitude: number;
    radius?: number;
    limit?: number;
    offset?: number;
    sortBy?: 'distance' | 'bestDeals';
    storeType?: StoreType[];
}
export interface ProductCategory extends BaseDocument {
    storeId: ObjectId;
    parentId?: ObjectId;
    name: string;
    description?: string;
    order: number;
    attributes?: Record<string, any>;
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
export type CreateProductDTO = Omit<Product, keyof BaseDocument>;
export type UpdateProductDTO = Partial<Omit<Product, keyof BaseDocument>>;
export type CreateCategoryDTO = Omit<ProductCategory, keyof BaseDocument>;
export type UpdateCategoryDTO = Partial<Omit<ProductCategory, keyof BaseDocument>>;

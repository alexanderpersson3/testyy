import type { ObjectId } from '../types/index.js';
import { Store, StoreProduct, StoreDeal, StoreWithDistance } from '../types/store.js';
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
    findNearbyStores(latitude: number, longitude: number, options?: {
        maxDistance?: number;
        limit?: number;
        filterByProducts?: ObjectId[];
    }): Promise<StoreWithDistance[]>;
    getStoreDeals(storeId: ObjectId): Promise<StoreDeal[]>;
    getStoreProducts(storeId: ObjectId): Promise<StoreProduct[]>;
    updateProductAvailability(storeId: ObjectId, updates: StoreProductUpdate[]): Promise<void>;
    getProductAvailability(productId: ObjectId, options?: {
        latitude?: number;
        longitude?: number;
        maxDistance?: number;
        limit?: number;
    }): Promise<StoreProductWithStore[]>;
}
export declare class MapService implements MapServiceInterface {
    private static instance;
    private db;
    private initialized;
    private storesCollection;
    private productsCollection;
    private recipesCollection;
    private constructor();
    private initialize;
    private ensureInitialized;
    static getInstance(): MapService;
    findNearbyStores(latitude: number, longitude: number, options?: {
        maxDistance?: number;
        limit?: number;
        filterByProducts?: ObjectId[];
    }): Promise<StoreWithDistance[]>;
    getStoreDeals(storeId: ObjectId): Promise<StoreDeal[]>;
    updateProductAvailability(storeId: ObjectId, updates: StoreProductUpdate[]): Promise<void>;
    getProductAvailability(productId: ObjectId, options?: {
        latitude?: number;
        longitude?: number;
        maxDistance?: number;
        limit?: number;
    }): Promise<StoreProductWithStore[]>;
    getStoreProducts(storeId: ObjectId): Promise<StoreProduct[]>;
    private calculateDistance;
    private toRad;
    private processStoreProducts;
}
export {};

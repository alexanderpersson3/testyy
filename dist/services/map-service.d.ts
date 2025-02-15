import type { ObjectId } from '../types/index.js';
import { Store, StoreProduct, StoreDeal } from '../types/store.js';
interface Coordinates {
    latitude: number;
    longitude: number;
}
interface ProductPrice {
    price: number;
    currency: string;
    unit: string;
}
interface StoreProductWithPrice {
    _id: ObjectId;
    storeId: ObjectId;
    productId: ObjectId;
    name: string;
    inStock: boolean;
    price: ProductPrice;
    quantity: number;
    unit: string;
    updatedAt: Date;
}
export declare class MapService {
    private static instance;
    private readonly db;
    private storesCollection;
    private productsCollection;
    private initialized;
    private constructor();
    static getInstance(): MapService;
    private ensureInitialized;
    /**
     * Find stores near a location
     */
    findNearbyStores(latitude: number, longitude: number, options?: {
        maxDistance?: number;
        limit?: number;
    }): Promise<Store[]>;
    /**
     * Get store details with product availability
     */
    getStoreDetails(storeId: ObjectId, options?: {
        includeProducts?: boolean;
        productIds?: ObjectId[];
    }): Promise<Store & {
        products?: StoreProductWithPrice[];
    }>;
    /**
     * Update store product availability
     */
    updateProductAvailability(storeId: ObjectId, updates: Array<{
        productId: ObjectId;
        inStock: boolean;
        price?: number;
        quantity?: number;
    }>): Promise<void>;
    /**
     * Get product availability across stores
     */
    getProductAvailability(productId: ObjectId, options?: {
        latitude?: number;
        longitude?: number;
        maxDistance?: number;
        limit?: number;
    }): Promise<StoreProductWithPrice[]>;
    findStoresForRecipe(recipeId: string, coordinates: Coordinates): Promise<Array<{
        store: Store;
        availableIngredients: number;
        totalIngredients: number;
        deals: Array<{
            ingredient: string;
            discount: number;
        }>;
    }>>;
    getStoreBestDeals(storeId: string): Promise<Array<{
        product: StoreProductWithPrice;
        discount: number;
        originalPrice: number;
        discountedPrice: number;
    }>>;
    updateStoreWaitTime(storeId: string, waitTime: number): Promise<void>;
    addStoreDeal(storeId: string, productId: string, discount: number, startDate: Date, endDate: Date): Promise<void>;
    getStoreProducts(storeId: ObjectId): Promise<StoreProduct[]>;
    getStoreDeals(storeId: ObjectId): Promise<StoreDeal[]>;
    updateStoreLocation(storeId: ObjectId, latitude: number, longitude: number): Promise<void>;
    updateStoreHours(storeId: ObjectId, hours: {
        [key: string]: {
            open: string;
            close: string;
        };
    }): Promise<void>;
}
export {};

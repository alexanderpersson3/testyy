import { Collection, ObjectId } from 'mongodb';
export interface Store {
    _id?: ObjectId;
    name: string;
    type: 'grocery' | 'pharmacy' | 'specialty';
    location: {
        address: string;
        city: string;
        coordinates: [number, number];
    };
    openingHours: {
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
    features: {
        hasParking: boolean;
        isWheelchairAccessible: boolean;
        acceptsCreditCards: boolean;
        hasDelivery: boolean;
    };
    averageWaitTime?: number;
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
export declare class StoreService {
    private storesCollection;
    private productsCollection;
    private dealsCollection;
    constructor(storesCollection: Collection<Store>, productsCollection: Collection<Product>, dealsCollection: Collection<Deal>);
    getNearbyStores(coordinates: [number, number], maxDistance?: number, // 10km
    type?: Store['type']): Promise<Store[]>;
    getStoresByWaitTime(maxWaitTime?: number): Promise<Store[]>;
    getStoresWithDeals(): Promise<Store[]>;
    getProducts(storeId: ObjectId, category?: string, inStockOnly?: boolean, page?: number, limit?: number): Promise<{
        products: Product[];
        total: number;
    }>;
    getRelatedProducts(productId: ObjectId): Promise<Product[]>;
    getProductDeals(productId: ObjectId): Promise<Deal[]>;
    getCategories(storeId: ObjectId): Promise<string[]>;
    getSubcategories(storeId: ObjectId, category: string): Promise<string[]>;
    getCurrentDeals(storeId: ObjectId, page?: number, limit?: number): Promise<{
        deals: Deal[];
        total: number;
    }>;
    getBestDeals(limit?: number): Promise<Deal[]>;
}
//# sourceMappingURL=store.d.ts.map
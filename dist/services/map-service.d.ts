import { ObjectId } from 'mongodb';
interface Coordinates {
    latitude: number;
    longitude: number;
}
interface Store {
    _id?: ObjectId;
    name: string;
    location: {
        coordinates: [number, number];
        address: string;
        city: string;
        state: string;
        country: string;
        postalCode: string;
    };
    type: 'supermarket' | 'specialty' | 'farmers_market' | 'convenience';
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
    features: {
        hasParking: boolean;
        isWheelchairAccessible: boolean;
        acceptsCreditCards: boolean;
        hasDelivery: boolean;
    };
    averageWaitTime?: number;
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
    recipeIngredients?: ObjectId[];
    updatedAt: Date;
}
interface SearchOptions {
    maxDistance?: number;
    storeType?: Store['type'];
    hasDeals?: boolean;
    isOpen?: boolean;
    maxWaitTime?: number;
}
export declare class MapService {
    private static instance;
    private storesCollection;
    private productsCollection;
    private initialized;
    private constructor();
    static getInstance(): MapService;
    private initializeCollections;
    private ensureInitialized;
    findNearbyStores(coordinates: Coordinates, options?: SearchOptions): Promise<Store[]>;
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
        product: StoreProduct;
        discount: number;
        originalPrice: number;
        discountedPrice: number;
    }>>;
    updateStoreWaitTime(storeId: string, waitTime: number): Promise<void>;
    addStoreDeal(storeId: string, productId: string, discount: number, startDate: Date, endDate: Date): Promise<void>;
}
export {};
//# sourceMappingURL=map-service.d.ts.map
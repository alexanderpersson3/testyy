interface PriceAlert {
    _id: ObjectId;
    userId: ObjectId;
    productId: ObjectId;
    storeId: ObjectId;
    targetPrice: number;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}
interface PriceHistory {
    _id: ObjectId;
    productId: ObjectId;
    storeId: ObjectId;
    price: number;
    currency: string;
    inStock: boolean;
    timestamp: Date;
}
interface Location {
    latitude: number;
    longitude: number;
}
export declare class PriceTrackingService {
    private static instance;
    private db;
    private constructor();
    static getInstance(): PriceTrackingService;
    createPriceAlert(userId: ObjectId, productId: ObjectId, storeId: ObjectId, targetPrice: number): Promise<PriceAlert>;
    updatePriceAlert(alertId: ObjectId, userId: ObjectId, update: Partial<Pick<PriceAlert, 'targetPrice' | 'isActive'>>): Promise<PriceAlert | null>;
    getPriceAlerts(userId: ObjectId): Promise<PriceAlert[]>;
    trackPrice(productId: ObjectId, storeId: ObjectId, price: number, currency: string, inStock: boolean): Promise<void>;
    getPriceHistory(productId: ObjectId, storeId: ObjectId, days?: number): Promise<PriceHistory[]>;
    findBestPrices(productIds: ObjectId[], location: Location, maxDistance?: number): Promise<Map<string, {
        price: number;
        currency: string;
        storeId: string;
    }>>;
}
export {};

import { DatabaseService } from '../db/database.service.js';;

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

export class PriceTrackingService {
  private static instance: PriceTrackingService;
  private db: DatabaseService;

  private constructor() {
    this.db = DatabaseService.getInstance();
  }

  public static getInstance(): PriceTrackingService {
    if (!PriceTrackingService.instance) {
      PriceTrackingService.instance = new PriceTrackingService();
    }
    return PriceTrackingService.instance;
  }

  async createPriceAlert(
    userId: ObjectId,
    productId: ObjectId,
    storeId: ObjectId,
    targetPrice: number
  ): Promise<PriceAlert> {
    const alert: PriceAlert = {
      _id: new ObjectId(),
      userId,
      productId,
      storeId,
      targetPrice,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await this.db.getCollection('priceAlerts').insertOne(alert);
    return alert;
  }

  async updatePriceAlert(
    alertId: ObjectId,
    userId: ObjectId,
    update: Partial<Pick<PriceAlert, 'targetPrice' | 'isActive'>>
  ): Promise<PriceAlert | null> {
    const result = await this.db.getCollection('priceAlerts').findOneAndUpdate(
      { _id: alertId, userId },
      {
        $set: {
          ...update,
          updatedAt: new Date(),
        },
      },
      { returnDocument: 'after' }
    );

    return result ? (result.value as unknown as PriceAlert) : null;
  }

  async getPriceAlerts(userId: ObjectId): Promise<PriceAlert[]> {
    return this.db.getCollection('priceAlerts')
      .find({ userId })
      .sort({ createdAt: -1 })
      .toArray();
  }

  async trackPrice(
    productId: ObjectId,
    storeId: ObjectId,
    price: number,
    currency: string,
    inStock: boolean
  ): Promise<void> {
    const pricePoint: PriceHistory = {
      _id: new ObjectId(),
      productId,
      storeId,
      price,
      currency,
      inStock,
      timestamp: new Date(),
    };

    await this.db.getCollection('priceHistory').insertOne(pricePoint);

    // Check and notify users with matching price alerts
    const alerts = await this.db.getCollection('priceAlerts').find({
      productId,
      storeId,
      isActive: true,
      targetPrice: { $gte: price },
    }).toArray();

    // TODO: Implement notification logic for matching alerts
  }

  async getPriceHistory(
    productId: ObjectId,
    storeId: ObjectId,
    days?: number
  ): Promise<PriceHistory[]> {
    const query: any = { productId, storeId };
    
    if (days) {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);
      query.timestamp = { $gte: cutoffDate };
    }

    return this.db.getCollection('priceHistory')
      .find(query)
      .sort({ timestamp: -1 })
      .toArray();
  }

  async findBestPrices(
    productIds: ObjectId[],
    location: Location,
    maxDistance: number = 10000 // Default to 10km
  ): Promise<Map<string, { price: number; currency: string; storeId: string }>> {
    const result = new Map();

    // TODO: Implement geospatial query to find stores within maxDistance
    // For now, just return the lowest price for each product
    for (const productId of productIds) {
      const latestPrice = await this.db.getCollection('priceHistory')
        .find({ productId, inStock: true })
        .sort({ timestamp: -1 })
        .limit(1)
        .toArray();

      if (latestPrice.length > 0) {
        result.set(productId.toHexString(), {
          price: latestPrice[0].price,
          currency: latestPrice[0].currency,
          storeId: latestPrice[0].storeId.toHexString(),
        });
      }
    }

    return result;
  }
} 
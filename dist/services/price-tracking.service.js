import { DatabaseService } from '../db/database.service.js';
export class PriceTrackingService {
    constructor() {
        this.db = DatabaseService.getInstance();
    }
    static getInstance() {
        if (!PriceTrackingService.instance) {
            PriceTrackingService.instance = new PriceTrackingService();
        }
        return PriceTrackingService.instance;
    }
    async createPriceAlert(userId, productId, storeId, targetPrice) {
        const alert = {
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
    async updatePriceAlert(alertId, userId, update) {
        const result = await this.db.getCollection('priceAlerts').findOneAndUpdate({ _id: alertId, userId }, {
            $set: {
                ...update,
                updatedAt: new Date(),
            },
        }, { returnDocument: 'after' });
        return result ? result.value : null;
    }
    async getPriceAlerts(userId) {
        return this.db.getCollection('priceAlerts')
            .find({ userId })
            .sort({ createdAt: -1 })
            .toArray();
    }
    async trackPrice(productId, storeId, price, currency, inStock) {
        const pricePoint = {
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
    async getPriceHistory(productId, storeId, days) {
        const query = { productId, storeId };
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
    async findBestPrices(productIds, location, maxDistance = 10000 // Default to 10km
    ) {
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
//# sourceMappingURL=price-tracking.service.js.map
import { DatabaseService } from '../db/database.service.js';
import logger from '../utils/logger.js';
export class PromotionService {
    constructor() {
        this.initialized = false;
        this.db = DatabaseService.getInstance();
        this.initialize().catch(error => {
            logger.error('Failed to initialize PromotionService:', error);
        });
    }
    async initialize() {
        if (this.initialized)
            return;
        try {
            await this.db.connect();
            this.promotionsCollection = this.db.getCollection('promotions');
            this.initialized = true;
            logger.info('PromotionService initialized successfully');
        }
        catch (error) {
            logger.error('Failed to initialize PromotionService:', error);
            throw error;
        }
    }
    async ensureInitialized() {
        if (!this.initialized) {
            await this.initialize();
        }
    }
    static getInstance() {
        if (!PromotionService.instance) {
            PromotionService.instance = new PromotionService();
        }
        return PromotionService.instance;
    }
    async getActivePromotions(userId) {
        await this.ensureInitialized();
        const now = new Date();
        return this.promotionsCollection
            .find({
            userId,
            status: 'active',
            startDate: { $lte: now },
            endDate: { $gte: now },
        })
            .toArray();
    }
    async getPromotionById(promotionId, userId) {
        await this.ensureInitialized();
        return this.promotionsCollection.findOne({
            _id: promotionId,
            userId,
        });
    }
    async createPromotion(data) {
        await this.ensureInitialized();
        const now = new Date();
        const promotion = {
            _id: new ObjectId(),
            ...data,
            startDate: new Date(data.startDate),
            endDate: new Date(data.endDate),
            status: 'active',
            createdAt: now,
            updatedAt: now,
        };
        await this.promotionsCollection.insertOne(promotion);
        return promotion;
    }
    async updatePromotion(promotionId, userId, updates) {
        await this.ensureInitialized();
        const updateData = {
            ...updates,
            updatedAt: new Date(),
        };
        if (updates.startDate) {
            updateData.startDate = new Date(updates.startDate);
        }
        if (updates.endDate) {
            updateData.endDate = new Date(updates.endDate);
        }
        const result = await this.promotionsCollection.findOneAndUpdate({ _id: promotionId, userId }, { $set: updateData }, { returnDocument: 'after' });
        return result.value;
    }
    async deletePromotion(promotionId, userId) {
        await this.ensureInitialized();
        const result = await this.promotionsCollection.deleteOne({
            _id: promotionId,
            userId,
        });
        return result.deletedCount > 0;
    }
}
//# sourceMappingURL=promotion.service.js.map
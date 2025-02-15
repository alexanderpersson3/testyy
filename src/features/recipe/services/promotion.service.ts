;
;
import type { Collection } from 'mongodb';
import { DatabaseService } from '../db/database.service.js';;
import logger from '../utils/logger.js';

interface Promotion {
  _id: ObjectId;
  userId: ObjectId;
  title: string;
  description: string;
  startDate: Date;
  endDate: Date;
  discountPercentage: number;
  itemId: ObjectId;
  itemType: 'recipe' | 'ingredient';
  status: 'active' | 'inactive';
  createdAt: Date;
  updatedAt: Date;
}

interface CreatePromotionDTO {
  userId: ObjectId;
  title: string;
  description: string;
  startDate: string | Date;
  endDate: string | Date;
  discountPercentage: number;
  itemId: ObjectId;
  itemType: 'recipe' | 'ingredient';
}

export class PromotionService {
  private static instance: PromotionService;
  private initialized: boolean = false;
  private db: DatabaseService;
  private promotionsCollection!: Collection<Promotion>;

  private constructor() {
    this.db = DatabaseService.getInstance();
    this.initialize().catch(error => {
      logger.error('Failed to initialize PromotionService:', error);
    });
  }

  private async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      await this.db.connect();
      this.promotionsCollection = this.db.getCollection<Promotion>('promotions');
      this.initialized = true;
      logger.info('PromotionService initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize PromotionService:', error);
      throw error;
    }
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  public static getInstance(): PromotionService {
    if (!PromotionService.instance) {
      PromotionService.instance = new PromotionService();
    }
    return PromotionService.instance;
  }

  async getActivePromotions(userId: ObjectId): Promise<Promotion[]> {
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

  async getPromotionById(promotionId: ObjectId, userId: ObjectId): Promise<Promotion | null> {
    await this.ensureInitialized();
    return this.promotionsCollection.findOne({
      _id: promotionId,
      userId,
    });
  }

  async createPromotion(data: CreatePromotionDTO): Promise<Promotion> {
    await this.ensureInitialized();

    const now = new Date();
    const promotion: Promotion = {
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

  async updatePromotion(
    promotionId: ObjectId,
    userId: ObjectId,
    updates: Partial<Promotion>
  ): Promise<Promotion | null> {
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

    const result = await this.promotionsCollection.findOneAndUpdate(
      { _id: promotionId, userId },
      { $set: updateData },
      { returnDocument: 'after' }
    );

    return result.value;
  }

  async deletePromotion(promotionId: ObjectId, userId: ObjectId): Promise<boolean> {
    await this.ensureInitialized();

    const result = await this.promotionsCollection.deleteOne({
      _id: promotionId,
      userId,
    });

    return result.deletedCount > 0;
  }
} 
import { DatabaseService } from '../db/database.service.js';
import { ObjectId } from 'mongodb';
import { BaseRepository } from '../../../core/database/base.repository';
import { ServiceFactory } from '../../../core/di/service.factory';
import { PriceSyncResult, PriceAlertResult } from '../../../core/types/sync';
import { Recipe } from '../types/recipe.types';

interface PriceAlert {
  _id: ObjectId;
  userId: ObjectId;
  recipeId: ObjectId;
  targetPrice: number;
  currentPrice: number;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface PriceHistory {
  _id: ObjectId;
  recipeId: ObjectId;
  prices: {
    date: Date;
    total: number;
    ingredients: {
      ingredientId: ObjectId;
      price: number;
    }[];
  }[];
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
    recipeId: ObjectId,
    targetPrice: number
  ): Promise<PriceAlert> {
    const alert: PriceAlert = {
      _id: new ObjectId(),
      userId,
      recipeId,
      targetPrice,
      currentPrice: 0,
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await this.db.getCollection('priceAlerts').insertOne(alert);
    return alert;
  }

  async updatePriceAlert(
    alertId: ObjectId,
    userId: ObjectId,
    update: Partial<Pick<PriceAlert, 'targetPrice' | 'active'>>
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
    recipeId: ObjectId,
    price: number,
    currentPrice: number
  ): Promise<void> {
    const history = await this.db.getCollection('priceHistory').findOne({ recipeId });
    const pricePoint = {
      date: new Date(),
      total: price,
      ingredients: [] // TODO: Add ingredient price breakdown
    };

    if (history) {
      await this.db.getCollection('priceHistory').updateOne(
        { _id: history._id },
        {
          $push: { prices: pricePoint }
        }
      );
    } else {
      await this.db.getCollection('priceHistory').insertOne({
        _id: new ObjectId(),
        recipeId,
        prices: [pricePoint]
      });
    }

    // Check and notify users with matching price alerts
    const alerts = await this.db.getCollection('priceAlerts').find({
      recipeId,
      active: true,
      targetPrice: { $lte: price },
    }).toArray();

    // TODO: Implement notification logic for matching alerts
  }

  async getPriceHistory(
    recipeId: ObjectId,
    days?: number
  ): Promise<PriceHistory[]> {
    const query: any = { recipeId };
    
    if (days) {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);
      query.prices.date = { $gte: cutoffDate };
    }

    return this.db.getCollection('priceHistory')
      .find(query)
      .sort({ 'prices.date': -1 })
      .toArray();
  }

  async findBestPrices(
    recipeIds: ObjectId[],
    location: Location,
    maxDistance: number = 10000 // Default to 10km
  ): Promise<Map<string, { price: number; currency: string; recipeId: string }>> {
    const result = new Map();

    // TODO: Implement geospatial query to find recipes within maxDistance
    // For now, just return the lowest price for each recipe
    for (const recipeId of recipeIds) {
      const latestPrice = await this.db.getCollection('priceHistory')
        .find({ recipeId, 'prices.date': { $exists: true } })
        .sort({ 'prices.date': -1 })
        .limit(1)
        .toArray();

      if (latestPrice.length > 0) {
        result.set(recipeId.toHexString(), {
          price: latestPrice[0].prices[0].total,
          currency: 'USD', // Assuming USD as the default currency
          recipeId: latestPrice[0]._id.toHexString(),
        });
      }
    }

    return result;
  }
}

export class PriceSyncService {
  private static instance: PriceSyncService;
  private recipeRepository: BaseRepository<Recipe>;
  private priceHistoryRepository: BaseRepository<PriceHistory>;
  private priceAlertRepository: BaseRepository<PriceAlert>;
  private logger = ServiceFactory.getLogger();

  private constructor() {
    this.recipeRepository = new BaseRepository<Recipe>('recipes');
    this.priceHistoryRepository = new BaseRepository<PriceHistory>('price_history');
    this.priceAlertRepository = new BaseRepository<PriceAlert>('price_alerts');
  }

  public static getInstance(): PriceSyncService {
    if (!PriceSyncService.instance) {
      PriceSyncService.instance = new PriceSyncService();
    }
    return PriceSyncService.instance;
  }

  /**
   * Synchronize recipe prices with current ingredient prices
   */
  public async syncRecipePrices(): Promise<PriceSyncResult> {
    const startTime = Date.now();
    const result: PriceSyncResult = {
      success: true,
      timestamp: new Date(),
      duration: 0,
      totalRecipes: 0,
      updatedPrices: 0,
      priceAlerts: 0,
      errors: []
    };

    try {
      // Get all recipes
      const recipes = await this.recipeRepository.find({});
      result.totalRecipes = recipes.length;

      for (const recipe of recipes) {
        try {
          // Calculate new total price
          const newPrice = await this.calculateRecipePrice(recipe);
          
          // Update recipe price
          await this.recipeRepository.updateById(recipe._id, {
            $set: {
              'price.total': newPrice,
              'price.updatedAt': new Date()
            }
          });

          // Add to price history
          await this.addPriceHistory(recipe._id, newPrice);
          
          result.updatedPrices++;
        } catch (error) {
          result.errors.push({
            itemId: recipe._id,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }
    } catch (error) {
      result.success = false;
      this.logger.error('Failed to sync recipe prices', { error });
    }

    result.duration = Date.now() - startTime;
    return result;
  }

  /**
   * Update price alerts based on current prices
   */
  public async updatePriceAlerts(): Promise<PriceAlertResult> {
    const result: PriceAlertResult = {
      priceAlerts: 0,
      errors: []
    };

    try {
      // Get all active price alerts
      const alerts = await this.priceAlertRepository.find({ active: true });

      for (const alert of alerts) {
        try {
          const recipe = await this.recipeRepository.findById(alert.recipeId);
          if (!recipe) continue;

          const currentPrice = recipe.price?.total || 0;
          
          // Check if price meets target
          if (currentPrice <= alert.targetPrice) {
            // Update alert status
            await this.priceAlertRepository.updateById(alert._id, {
              $set: {
                active: false,
                currentPrice,
                updatedAt: new Date()
              }
            });

            // TODO: Send notification to user
            result.priceAlerts++;
          }
        } catch (error) {
          result.errors.push({
            itemId: alert._id,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }
    } catch (error) {
      this.logger.error('Failed to update price alerts', { error });
    }

    return result;
  }

  /**
   * Calculate total recipe price based on current ingredient prices
   */
  private async calculateRecipePrice(recipe: Recipe): Promise<number> {
    // TODO: Implement price calculation logic
    return 0;
  }

  /**
   * Add price point to recipe's price history
   */
  private async addPriceHistory(recipeId: ObjectId, price: number): Promise<void> {
    const history = await this.priceHistoryRepository.findOne({ recipeId });
    const pricePoint = {
      date: new Date(),
      total: price,
      ingredients: [] // TODO: Add ingredient price breakdown
    };

    if (history) {
      await this.priceHistoryRepository.updateById(history._id, {
        $push: { prices: pricePoint }
      });
    } else {
      await this.priceHistoryRepository.create({
        _id: new ObjectId(),
        recipeId,
        prices: [pricePoint]
      });
    }
  }
} 
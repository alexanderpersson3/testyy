;
;
import type { Collection } from 'mongodb';
import { DatabaseService } from '../db/database.service.js';;
import { CacheService } from '../cache.service.js';;
import { HealthData, HealthProvider, HealthConnection, HealthKitConfig, GoogleFitConfig,  } from '../types/health.js';;
import { logger } from '../logging.service.js';;

export class HealthIntegrationService {
  private static instance: HealthIntegrationService;
  private readonly CACHE_TTL = 3600; // 1 hour
  private db: DatabaseService;
  private cache: CacheService;

  private constructor() {
    this.db = DatabaseService.getInstance();
    this.cache = CacheService.getInstance();
  }

  public static getInstance(): HealthIntegrationService {
    if (!HealthIntegrationService.instance) {
      HealthIntegrationService.instance = new HealthIntegrationService();
    }
    return HealthIntegrationService.instance;
  }

  /**
   * Connect to health provider
   */
  async connectProvider(
    userId: string,
    provider: HealthProvider,
    accessToken: string
  ): Promise<void> {
    const connection: HealthConnection = {
      userId: new ObjectId(userId),
      provider,
      accessToken,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await this.db.getCollection<HealthConnection>('health_connections').insertOne(connection);
  }

  /**
   * Disconnect from health provider
   */
  async disconnectProvider(userId: string, provider: HealthProvider): Promise<void> {
    await this.db.getCollection<HealthConnection>('health_connections').updateOne(
      {
        userId: new ObjectId(userId),
        provider,
        isActive: true,
      },
      {
        $set: {
          isActive: false,
          updatedAt: new Date(),
        },
      }
    );
  }

  /**
   * Get health data
   */
  async getHealthData(userId: string): Promise<HealthData | null> {
    try {
      const cacheKey = `health:${userId}`;
      const cached = await this.cache.get<string>(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      const connection = await this.db
        .getCollection<HealthConnection>('health_connections')
        .findOne({
          userId: new ObjectId(userId),
          isActive: true,
        });

      if (!connection) {
        return null;
      }

      const healthData = await this.fetchHealthData(connection);
      if (healthData) {
        await this.cache.set(cacheKey, JSON.stringify(healthData), { ttl: this.CACHE_TTL });
      }

      return healthData;
    } catch (error) {
      logger.error(
        'Error getting health data:',
        error instanceof Error ? error : new Error(String(error))
      );
      throw error;
    }
  }

  /**
   * Sync health data
   */
  async syncHealthData(userId: string): Promise<void> {
    try {
      const connection = await this.db
        .getCollection<HealthConnection>('health_connections')
        .findOne({
          userId: new ObjectId(userId),
          isActive: true,
        });

      if (!connection) {
        return;
      }

      const healthData = await this.fetchHealthData(connection);
      if (healthData) {
        await this.db.getCollection<HealthData>('health_data').updateOne(
          { userId: new ObjectId(userId) },
          {
            $set: {
              ...healthData,
              updatedAt: new Date(),
            },
          },
          { upsert: true }
        );

        const cacheKey = `health:${userId}`;
        await this.cache.set(cacheKey, JSON.stringify(healthData), { ttl: this.CACHE_TTL });
      }
    } catch (error) {
      logger.error(
        'Error syncing health data:',
        error instanceof Error ? error : new Error(String(error))
      );
      throw error;
    }
  }

  /**
   * Get HealthKit configuration
   */
  getHealthKitConfig(): HealthKitConfig {
    return {
      permissions: [
        'HKQuantityTypeIdentifierDietaryEnergyConsumed',
        'HKQuantityTypeIdentifierDietaryProtein',
        'HKQuantityTypeIdentifierDietaryCarbohydrates',
        'HKQuantityTypeIdentifierDietaryFatTotal',
      ],
      metrics: {
        calories: 'HKQuantityTypeIdentifierDietaryEnergyConsumed',
        protein: 'HKQuantityTypeIdentifierDietaryProtein',
        carbs: 'HKQuantityTypeIdentifierDietaryCarbohydrates',
        fat: 'HKQuantityTypeIdentifierDietaryFatTotal',
      },
    };
  }

  /**
   * Get Google Fit configuration
   */
  getGoogleFitConfig(): GoogleFitConfig {
    return {
      scopes: [
        'https://www.googleapis.com/auth/fitness.nutrition.read',
        'https://www.googleapis.com/auth/fitness.nutrition.write',
      ],
      dataTypes: {
        calories: 'com.google.calories.consumed',
        nutrients: 'com.google.nutrition',
      },
    };
  }

  /**
   * Fetch health data from provider
   */
  private async fetchHealthData(connection: HealthConnection): Promise<HealthData | null> {
    // Implementation would depend on the specific health provider's API
    // This is just a placeholder
    return {
      userId: connection.userId,
      provider: connection.provider,
      metrics: {
        steps: 0,
        calories: 0,
        distance: 0,
        activeMinutes: 0,
      },
      lastSynced: new Date(),
    };
  }

  /**
   * Invalidate cache for a user's health data
   */
  private async invalidateCache(userId: string): Promise<void> {
    const cacheKey = `health:${userId}`;
    await this.cache.delete(cacheKey);
  }
}

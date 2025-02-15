import { DatabaseService } from '../db/database.service.js';
import { CacheService } from '../cache.service.js';
import { HealthData, HealthProvider, HealthConnection, HealthKitConfig, GoogleFitConfig, } from '../types/health.js';
import { logger } from '../logging.service.js';
export class HealthIntegrationService {
    constructor() {
        this.CACHE_TTL = 3600; // 1 hour
        this.db = DatabaseService.getInstance();
        this.cache = CacheService.getInstance();
    }
    static getInstance() {
        if (!HealthIntegrationService.instance) {
            HealthIntegrationService.instance = new HealthIntegrationService();
        }
        return HealthIntegrationService.instance;
    }
    /**
     * Connect to health provider
     */
    async connectProvider(userId, provider, accessToken) {
        const connection = {
            userId: new ObjectId(userId),
            provider,
            accessToken,
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        await this.db.getCollection('health_connections').insertOne(connection);
    }
    /**
     * Disconnect from health provider
     */
    async disconnectProvider(userId, provider) {
        await this.db.getCollection('health_connections').updateOne({
            userId: new ObjectId(userId),
            provider,
            isActive: true,
        }, {
            $set: {
                isActive: false,
                updatedAt: new Date(),
            },
        });
    }
    /**
     * Get health data
     */
    async getHealthData(userId) {
        try {
            const cacheKey = `health:${userId}`;
            const cached = await this.cache.get(cacheKey);
            if (cached) {
                return JSON.parse(cached);
            }
            const connection = await this.db
                .getCollection('health_connections')
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
        }
        catch (error) {
            logger.error('Error getting health data:', error instanceof Error ? error : new Error(String(error)));
            throw error;
        }
    }
    /**
     * Sync health data
     */
    async syncHealthData(userId) {
        try {
            const connection = await this.db
                .getCollection('health_connections')
                .findOne({
                userId: new ObjectId(userId),
                isActive: true,
            });
            if (!connection) {
                return;
            }
            const healthData = await this.fetchHealthData(connection);
            if (healthData) {
                await this.db.getCollection('health_data').updateOne({ userId: new ObjectId(userId) }, {
                    $set: {
                        ...healthData,
                        updatedAt: new Date(),
                    },
                }, { upsert: true });
                const cacheKey = `health:${userId}`;
                await this.cache.set(cacheKey, JSON.stringify(healthData), { ttl: this.CACHE_TTL });
            }
        }
        catch (error) {
            logger.error('Error syncing health data:', error instanceof Error ? error : new Error(String(error)));
            throw error;
        }
    }
    /**
     * Get HealthKit configuration
     */
    getHealthKitConfig() {
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
    getGoogleFitConfig() {
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
    async fetchHealthData(connection) {
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
    async invalidateCache(userId) {
        const cacheKey = `health:${userId}`;
        await this.cache.delete(cacheKey);
    }
}
//# sourceMappingURL=health-integration.service.js.map
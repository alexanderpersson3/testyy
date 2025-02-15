import { HealthData, HealthProvider, HealthKitConfig, GoogleFitConfig } from '../types/health.js';
export declare class HealthIntegrationService {
    private static instance;
    private readonly CACHE_TTL;
    private db;
    private cache;
    private constructor();
    static getInstance(): HealthIntegrationService;
    /**
     * Connect to health provider
     */
    connectProvider(userId: string, provider: HealthProvider, accessToken: string): Promise<void>;
    /**
     * Disconnect from health provider
     */
    disconnectProvider(userId: string, provider: HealthProvider): Promise<void>;
    /**
     * Get health data
     */
    getHealthData(userId: string): Promise<HealthData | null>;
    /**
     * Sync health data
     */
    syncHealthData(userId: string): Promise<void>;
    /**
     * Get HealthKit configuration
     */
    getHealthKitConfig(): HealthKitConfig;
    /**
     * Get Google Fit configuration
     */
    getGoogleFitConfig(): GoogleFitConfig;
    /**
     * Fetch health data from provider
     */
    private fetchHealthData;
    /**
     * Invalidate cache for a user's health data
     */
    private invalidateCache;
}

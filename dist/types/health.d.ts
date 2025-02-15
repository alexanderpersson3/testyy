import { ObjectId } from 'mongodb';
export type HealthProvider = 'healthkit' | 'googlefit';
export interface HealthMetrics {
    steps: number;
    calories: number;
    distance: number;
    activeMinutes: number;
}
export interface HealthData {
    userId: ObjectId;
    provider: HealthProvider;
    metrics: HealthMetrics;
    lastSynced: Date;
}
export interface HealthConnection {
    userId: ObjectId;
    provider: HealthProvider;
    accessToken: string;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}
export interface HealthKitConfig {
    permissions: string[];
    metrics: {
        calories: string;
        protein: string;
        carbs: string;
        fat: string;
    };
}
export interface GoogleFitConfig {
    scopes: string[];
    dataTypes: {
        calories: string;
        nutrients: string;
    };
}

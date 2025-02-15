import { z } from 'zod';
export declare const syncOperationSchema: z.ZodEnum<["create", "update", "delete"]>;
export declare const entityTypeSchema: z.ZodEnum<["recipe", "review", "collection"]>;
export declare const syncStatusSchema: z.ZodEnum<["pending", "processing", "completed", "failed"]>;
export declare const resolutionSchema: z.ZodEnum<["client_wins", "server_wins", "manual_merge"]>;
export declare const syncItemSchema: z.ZodObject<{
    entityId: z.ZodString;
    entityType: z.ZodEnum<["recipe", "review", "collection"]>;
    operation: z.ZodEnum<["create", "update", "delete"]>;
    data: z.ZodRecord<z.ZodString, z.ZodAny>;
    clientTimestamp: z.ZodString;
    deviceId: z.ZodString;
    version: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    data: Record<string, any>;
    operation: "delete" | "create" | "update";
    version: number;
    deviceId: string;
    entityId: string;
    entityType: "recipe" | "collection" | "review";
    clientTimestamp: string;
}, {
    data: Record<string, any>;
    operation: "delete" | "create" | "update";
    version: number;
    deviceId: string;
    entityId: string;
    entityType: "recipe" | "collection" | "review";
    clientTimestamp: string;
}>;
export declare const queueSyncSchema: z.ZodObject<{
    items: z.ZodArray<z.ZodObject<{
        entityId: z.ZodString;
        entityType: z.ZodEnum<["recipe", "review", "collection"]>;
        operation: z.ZodEnum<["create", "update", "delete"]>;
        data: z.ZodRecord<z.ZodString, z.ZodAny>;
        clientTimestamp: z.ZodString;
        deviceId: z.ZodString;
        version: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        data: Record<string, any>;
        operation: "delete" | "create" | "update";
        version: number;
        deviceId: string;
        entityId: string;
        entityType: "recipe" | "collection" | "review";
        clientTimestamp: string;
    }, {
        data: Record<string, any>;
        operation: "delete" | "create" | "update";
        version: number;
        deviceId: string;
        entityId: string;
        entityType: "recipe" | "collection" | "review";
        clientTimestamp: string;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    items: {
        data: Record<string, any>;
        operation: "delete" | "create" | "update";
        version: number;
        deviceId: string;
        entityId: string;
        entityType: "recipe" | "collection" | "review";
        clientTimestamp: string;
    }[];
}, {
    items: {
        data: Record<string, any>;
        operation: "delete" | "create" | "update";
        version: number;
        deviceId: string;
        entityId: string;
        entityType: "recipe" | "collection" | "review";
        clientTimestamp: string;
    }[];
}>;
export declare const processBatchSchema: z.ZodObject<{
    batchId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    batchId: string;
}, {
    batchId: string;
}>;
export declare const resolveConflictSchema: z.ZodObject<{
    conflictId: z.ZodString;
    resolution: z.ZodEnum<["client_wins", "server_wins", "manual_merge"]>;
    manualData: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
}, "strip", z.ZodTypeAny, {
    resolution: "client_wins" | "server_wins" | "manual_merge";
    conflictId: string;
    manualData?: Record<string, any> | undefined;
}, {
    resolution: "client_wins" | "server_wins" | "manual_merge";
    conflictId: string;
    manualData?: Record<string, any> | undefined;
}>;
export declare const syncStatusQuerySchema: z.ZodObject<{
    deviceId: z.ZodString;
    lastSyncedAt: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    deviceId: string;
    lastSyncedAt?: string | undefined;
}, {
    deviceId: string;
    lastSyncedAt?: string | undefined;
}>;
export declare const syncMetadataSchema: z.ZodObject<{
    lastSyncedAt: z.ZodString;
    deviceId: z.ZodString;
    version: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    version: number;
    deviceId: string;
    lastSyncedAt: string;
}, {
    version: number;
    deviceId: string;
    lastSyncedAt: string;
}>;
export declare const syncResultSchema: z.ZodObject<{
    success: z.ZodBoolean;
    processedItems: z.ZodNumber;
    failedItems: z.ZodNumber;
    conflicts: z.ZodArray<z.ZodObject<{
        conflictId: z.ZodString;
        resolution: z.ZodEnum<["client_wins", "server_wins", "manual_merge"]>;
        manualData: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
    }, "strip", z.ZodTypeAny, {
        resolution: "client_wins" | "server_wins" | "manual_merge";
        conflictId: string;
        manualData?: Record<string, any> | undefined;
    }, {
        resolution: "client_wins" | "server_wins" | "manual_merge";
        conflictId: string;
        manualData?: Record<string, any> | undefined;
    }>, "many">;
    newVersion: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    success: boolean;
    conflicts: {
        resolution: "client_wins" | "server_wins" | "manual_merge";
        conflictId: string;
        manualData?: Record<string, any> | undefined;
    }[];
    newVersion: number;
    processedItems: number;
    failedItems: number;
}, {
    success: boolean;
    conflicts: {
        resolution: "client_wins" | "server_wins" | "manual_merge";
        conflictId: string;
        manualData?: Record<string, any> | undefined;
    }[];
    newVersion: number;
    processedItems: number;
    failedItems: number;
}>;
export declare const syncConflictSchema: z.ZodObject<{
    _id: z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>;
    queueItemId: z.ZodEffects<z.ZodString, string, string>;
    clientVersion: z.ZodObject<{
        data: z.ZodRecord<z.ZodString, z.ZodAny>;
        timestamp: z.ZodDate;
        version: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        data: Record<string, any>;
        timestamp: Date;
        version: number;
    }, {
        data: Record<string, any>;
        timestamp: Date;
        version: number;
    }>;
    serverVersion: z.ZodObject<{
        data: z.ZodRecord<z.ZodString, z.ZodAny>;
        timestamp: z.ZodDate;
        version: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        data: Record<string, any>;
        timestamp: Date;
        version: number;
    }, {
        data: Record<string, any>;
        timestamp: Date;
        version: number;
    }>;
    resolution: z.ZodOptional<z.ZodEnum<["client_wins", "server_wins", "manual_merge"]>>;
    resolvedData: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
    resolvedAt: z.ZodOptional<z.ZodDate>;
    createdAt: z.ZodDate;
}, "strip", z.ZodTypeAny, {
    createdAt: Date;
    clientVersion: {
        data: Record<string, any>;
        timestamp: Date;
        version: number;
    };
    serverVersion: {
        data: Record<string, any>;
        timestamp: Date;
        version: number;
    };
    queueItemId: string;
    _id?: string | undefined;
    resolution?: "client_wins" | "server_wins" | "manual_merge" | undefined;
    resolvedAt?: Date | undefined;
    resolvedData?: Record<string, any> | undefined;
}, {
    createdAt: Date;
    clientVersion: {
        data: Record<string, any>;
        timestamp: Date;
        version: number;
    };
    serverVersion: {
        data: Record<string, any>;
        timestamp: Date;
        version: number;
    };
    queueItemId: string;
    _id?: string | undefined;
    resolution?: "client_wins" | "server_wins" | "manual_merge" | undefined;
    resolvedAt?: Date | undefined;
    resolvedData?: Record<string, any> | undefined;
}>;
export type SyncOperation = z.infer<typeof syncOperationSchema>;
export type EntityType = z.infer<typeof entityTypeSchema>;
export type SyncStatus = z.infer<typeof syncStatusSchema>;
export type Resolution = z.infer<typeof resolutionSchema>;
export type SyncItem = z.infer<typeof syncItemSchema>;
export type QueueSync = z.infer<typeof queueSyncSchema>;
export type ProcessBatch = z.infer<typeof processBatchSchema>;
export type ResolveConflict = z.infer<typeof resolveConflictSchema>;
export type SyncStatusQuery = z.infer<typeof syncStatusQuerySchema>;
export type SyncMetadata = z.infer<typeof syncMetadataSchema>;
export interface SyncQueueItem extends SyncItem {
    _id: string;
    userId: string;
    status: SyncStatus;
    retryCount: number;
    error?: string;
    createdAt: Date;
    updatedAt: Date;
}
export interface SyncBatch {
    _id: string;
    userId: string;
    items: SyncQueueItem[];
    status: SyncStatus;
    processedAt?: Date;
    error?: string;
    createdAt: Date;
    updatedAt: Date;
}
export interface SyncConflictDocument {
    _id: string;
    userId: string;
    entityId: string;
    entityType: EntityType;
    clientData: Record<string, any>;
    serverData: Record<string, any>;
    clientTimestamp: Date;
    serverTimestamp: Date;
    resolution?: Resolution;
    resolvedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}
export interface SyncResultDocument {
    success: boolean;
    processedItems: number;
    failedItems: number;
    conflicts: {
        conflictId: string;
        resolution: Resolution;
        manualData?: Record<string, any>;
    }[];
    newVersion: number;
}

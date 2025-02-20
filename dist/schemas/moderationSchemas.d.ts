import { z } from 'zod';
export declare const moderationActionSchema: z.ZodEnum<["approve", "reject", "request_changes"]>;
export declare const moderationPrioritySchema: z.ZodEnum<["low", "medium", "high"]>;
export declare const moderationStatusSchema: z.ZodEnum<["pending", "approved", "rejected", "changes_requested"]>;
export declare const moderationNoteSchema: z.ZodObject<{
    _id: z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>;
    recipeId: z.ZodEffects<z.ZodString, string, string>;
    adminId: z.ZodEffects<z.ZodString, string, string>;
    note: z.ZodString;
    action: z.ZodEnum<["approve", "reject", "request_changes"]>;
    createdAt: z.ZodDate;
}, "strip", z.ZodTypeAny, {
    createdAt: Date;
    action: "approve" | "reject" | "request_changes";
    recipeId: string;
    adminId: string;
    note: string;
    _id?: string | undefined;
}, {
    createdAt: Date;
    action: "approve" | "reject" | "request_changes";
    recipeId: string;
    adminId: string;
    note: string;
    _id?: string | undefined;
}>;
export declare const moderationQueueItemSchema: z.ZodObject<{
    _id: z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>;
    recipeId: z.ZodEffects<z.ZodString, string, string>;
    status: z.ZodEnum<["pending", "approved", "rejected", "changes_requested"]>;
    submittedAt: z.ZodDate;
    reviewedAt: z.ZodOptional<z.ZodDate>;
    reviewedBy: z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>;
    priority: z.ZodEnum<["low", "medium", "high"]>;
    notes: z.ZodArray<z.ZodObject<{
        _id: z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>;
        recipeId: z.ZodEffects<z.ZodString, string, string>;
        adminId: z.ZodEffects<z.ZodString, string, string>;
        note: z.ZodString;
        action: z.ZodEnum<["approve", "reject", "request_changes"]>;
        createdAt: z.ZodDate;
    }, "strip", z.ZodTypeAny, {
        createdAt: Date;
        action: "approve" | "reject" | "request_changes";
        recipeId: string;
        adminId: string;
        note: string;
        _id?: string | undefined;
    }, {
        createdAt: Date;
        action: "approve" | "reject" | "request_changes";
        recipeId: string;
        adminId: string;
        note: string;
        _id?: string | undefined;
    }>, "many">;
    createdAt: z.ZodDate;
    updatedAt: z.ZodDate;
}, "strip", z.ZodTypeAny, {
    createdAt: Date;
    updatedAt: Date;
    status: "pending" | "rejected" | "approved" | "changes_requested";
    recipeId: string;
    notes: {
        createdAt: Date;
        action: "approve" | "reject" | "request_changes";
        recipeId: string;
        adminId: string;
        note: string;
        _id?: string | undefined;
    }[];
    priority: "high" | "low" | "medium";
    submittedAt: Date;
    _id?: string | undefined;
    reviewedAt?: Date | undefined;
    reviewedBy?: string | undefined;
}, {
    createdAt: Date;
    updatedAt: Date;
    status: "pending" | "rejected" | "approved" | "changes_requested";
    recipeId: string;
    notes: {
        createdAt: Date;
        action: "approve" | "reject" | "request_changes";
        recipeId: string;
        adminId: string;
        note: string;
        _id?: string | undefined;
    }[];
    priority: "high" | "low" | "medium";
    submittedAt: Date;
    _id?: string | undefined;
    reviewedAt?: Date | undefined;
    reviewedBy?: string | undefined;
}>;
export declare const addToQueueSchema: z.ZodObject<{
    recipeId: z.ZodString;
    priority: z.ZodOptional<z.ZodEnum<["low", "medium", "high"]>>;
}, "strip", z.ZodTypeAny, {
    recipeId: string;
    priority?: "high" | "low" | "medium" | undefined;
}, {
    recipeId: string;
    priority?: "high" | "low" | "medium" | undefined;
}>;
export declare const reviewRecipeSchema: z.ZodObject<{
    recipeId: z.ZodString;
    action: z.ZodEnum<["approve", "reject", "request_changes"]>;
    note: z.ZodString;
}, "strip", z.ZodTypeAny, {
    action: "approve" | "reject" | "request_changes";
    recipeId: string;
    note: string;
}, {
    action: "approve" | "reject" | "request_changes";
    recipeId: string;
    note: string;
}>;
export declare const queueQuerySchema: z.ZodObject<{
    status: z.ZodOptional<z.ZodArray<z.ZodEnum<["pending", "approved", "rejected", "changes_requested"]>, "many">>;
    priority: z.ZodOptional<z.ZodArray<z.ZodEnum<["low", "medium", "high"]>, "many">>;
    limit: z.ZodOptional<z.ZodNumber>;
    offset: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    limit?: number | undefined;
    status?: ("pending" | "rejected" | "approved" | "changes_requested")[] | undefined;
    offset?: number | undefined;
    priority?: ("high" | "low" | "medium")[] | undefined;
}, {
    limit?: number | undefined;
    status?: ("pending" | "rejected" | "approved" | "changes_requested")[] | undefined;
    offset?: number | undefined;
    priority?: ("high" | "low" | "medium")[] | undefined;
}>;
export declare const statsQuerySchema: z.ZodObject<{
    startDate: z.ZodString;
    endDate: z.ZodString;
}, "strip", z.ZodTypeAny, {
    startDate: string;
    endDate: string;
}, {
    startDate: string;
    endDate: string;
}>;
export declare const moderationStatsSchema: z.ZodObject<{
    totalReviewed: z.ZodNumber;
    approved: z.ZodNumber;
    rejected: z.ZodNumber;
    changesRequested: z.ZodNumber;
    averageResponseTime: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    rejected: number;
    approved: number;
    totalReviewed: number;
    changesRequested: number;
    averageResponseTime: number;
}, {
    rejected: number;
    approved: number;
    totalReviewed: number;
    changesRequested: number;
    averageResponseTime: number;
}>;
export declare const queuedRecipeSchema: z.ZodObject<z.objectUtil.extendShape<{
    _id: z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>;
    recipeId: z.ZodEffects<z.ZodString, string, string>;
    status: z.ZodEnum<["pending", "approved", "rejected", "changes_requested"]>;
    submittedAt: z.ZodDate;
    reviewedAt: z.ZodOptional<z.ZodDate>;
    reviewedBy: z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>;
    priority: z.ZodEnum<["low", "medium", "high"]>;
    notes: z.ZodArray<z.ZodObject<{
        _id: z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>;
        recipeId: z.ZodEffects<z.ZodString, string, string>;
        adminId: z.ZodEffects<z.ZodString, string, string>;
        note: z.ZodString;
        action: z.ZodEnum<["approve", "reject", "request_changes"]>;
        createdAt: z.ZodDate;
    }, "strip", z.ZodTypeAny, {
        createdAt: Date;
        action: "approve" | "reject" | "request_changes";
        recipeId: string;
        adminId: string;
        note: string;
        _id?: string | undefined;
    }, {
        createdAt: Date;
        action: "approve" | "reject" | "request_changes";
        recipeId: string;
        adminId: string;
        note: string;
        _id?: string | undefined;
    }>, "many">;
    createdAt: z.ZodDate;
    updatedAt: z.ZodDate;
}, {
    recipe: z.ZodObject<{
        _id: z.ZodEffects<z.ZodString, string, string>;
        name: z.ZodString;
        description: z.ZodString;
        status: z.ZodEnum<["pending", "approved", "rejected", "changes_requested"]>;
        createdAt: z.ZodDate;
        updatedAt: z.ZodDate;
    }, "strip", z.ZodTypeAny, {
        _id: string;
        createdAt: Date;
        updatedAt: Date;
        description: string;
        status: "pending" | "rejected" | "approved" | "changes_requested";
        name: string;
    }, {
        _id: string;
        createdAt: Date;
        updatedAt: Date;
        description: string;
        status: "pending" | "rejected" | "approved" | "changes_requested";
        name: string;
    }>;
}>, "strip", z.ZodTypeAny, {
    createdAt: Date;
    recipe: {
        _id: string;
        createdAt: Date;
        updatedAt: Date;
        description: string;
        status: "pending" | "rejected" | "approved" | "changes_requested";
        name: string;
    };
    updatedAt: Date;
    status: "pending" | "rejected" | "approved" | "changes_requested";
    recipeId: string;
    notes: {
        createdAt: Date;
        action: "approve" | "reject" | "request_changes";
        recipeId: string;
        adminId: string;
        note: string;
        _id?: string | undefined;
    }[];
    priority: "high" | "low" | "medium";
    submittedAt: Date;
    _id?: string | undefined;
    reviewedAt?: Date | undefined;
    reviewedBy?: string | undefined;
}, {
    createdAt: Date;
    recipe: {
        _id: string;
        createdAt: Date;
        updatedAt: Date;
        description: string;
        status: "pending" | "rejected" | "approved" | "changes_requested";
        name: string;
    };
    updatedAt: Date;
    status: "pending" | "rejected" | "approved" | "changes_requested";
    recipeId: string;
    notes: {
        createdAt: Date;
        action: "approve" | "reject" | "request_changes";
        recipeId: string;
        adminId: string;
        note: string;
        _id?: string | undefined;
    }[];
    priority: "high" | "low" | "medium";
    submittedAt: Date;
    _id?: string | undefined;
    reviewedAt?: Date | undefined;
    reviewedBy?: string | undefined;
}>;
export type ModerationNote = z.infer<typeof moderationNoteSchema>;
export type ModerationQueueItem = z.infer<typeof moderationQueueItemSchema>;
export type AddToQueueInput = z.infer<typeof addToQueueSchema>;
export type ReviewRecipeInput = z.infer<typeof reviewRecipeSchema>;
export type QueueQuery = z.infer<typeof queueQuerySchema>;
export type StatsQuery = z.infer<typeof statsQuerySchema>;
export type ModerationStats = z.infer<typeof moderationStatsSchema>;
export type QueuedRecipe = z.infer<typeof queuedRecipeSchema>;
export interface ModeratorStats {
    totalReviewed: number;
    approved: number;
    rejected: number;
    changesRequested: number;
    averageResponseTime: number;
}

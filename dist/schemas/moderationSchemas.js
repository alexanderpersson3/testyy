import { z } from 'zod';
import { ObjectId } from 'mongodb';
// Helper function to validate ObjectId
const objectIdSchema = z.string().refine((val) => {
    try {
        new ObjectId(val);
        return true;
    }
    catch {
        return false;
    }
}, { message: 'Invalid ObjectId format' });
// Base schemas for common types
export const moderationActionSchema = z.enum(['approve', 'reject', 'request_changes']);
export const moderationPrioritySchema = z.enum(['low', 'medium', 'high']);
export const moderationStatusSchema = z.enum(['pending', 'approved', 'rejected', 'changes_requested']);
// Schema for moderation notes
export const moderationNoteSchema = z.object({
    _id: objectIdSchema.optional(),
    recipeId: objectIdSchema,
    adminId: objectIdSchema,
    note: z.string().min(1).max(1000),
    action: moderationActionSchema,
    createdAt: z.date()
});
// Schema for queue item
export const moderationQueueItemSchema = z.object({
    _id: objectIdSchema.optional(),
    recipeId: objectIdSchema,
    status: moderationStatusSchema,
    submittedAt: z.date(),
    reviewedAt: z.date().optional(),
    reviewedBy: objectIdSchema.optional(),
    priority: moderationPrioritySchema,
    notes: z.array(moderationNoteSchema),
    createdAt: z.date(),
    updatedAt: z.date()
});
// Schema for adding to queue
export const addToQueueSchema = z.object({
    recipeId: z.string(),
    priority: moderationPrioritySchema.optional()
});
// Schema for reviewing recipe
export const reviewRecipeSchema = z.object({
    recipeId: z.string(),
    action: moderationActionSchema,
    note: z.string().min(1)
});
// Schema for queue query options
export const queueQuerySchema = z.object({
    status: moderationStatusSchema.array().optional(),
    priority: moderationPrioritySchema.array().optional(),
    limit: z.number().int().positive().optional(),
    offset: z.number().int().min(0).optional()
});
// Schema for stats query
export const statsQuerySchema = z.object({
    startDate: z.string(),
    endDate: z.string()
});
// Response schemas
export const moderationStatsSchema = z.object({
    totalReviewed: z.number().int().nonnegative(),
    approved: z.number().int().nonnegative(),
    rejected: z.number().int().nonnegative(),
    changesRequested: z.number().int().nonnegative(),
    averageResponseTime: z.number().nonnegative() // in minutes
});
export const queuedRecipeSchema = moderationQueueItemSchema.extend({
    recipe: z.object({
        _id: objectIdSchema,
        name: z.string(),
        description: z.string(),
        status: moderationStatusSchema,
        createdAt: z.date(),
        updatedAt: z.date(),
        // Add other recipe fields as needed
    })
});
//# sourceMappingURL=moderationSchemas.js.map
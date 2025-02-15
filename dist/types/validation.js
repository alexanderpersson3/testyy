import { z } from 'zod';
export const ingredientsSchema = z.object({
    ingredients: z.array(z.object({
        name: z.string(),
        amount: z.number(),
        unit: z.string(),
    })),
});
export const substitutionSchema = z.object({
    ingredient: z.string(),
    amount: z.number(),
    unit: z.string(),
    preferences: z.array(z.string()).optional(),
});
export const tipSchema = z.object({
    recipeId: z.string(),
    content: z.string(),
});
export const conversationSchema = z.object({
    messages: z.array(z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string(),
    })),
});
export const searchSchema = z.object({
    query: z.string(),
    filters: z.record(z.any()).optional(),
    page: z.number().optional(),
    limit: z.number().optional(),
    sort: z.record(z.any()).optional(),
});
export const timeRangeSchema = z.object({
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    timeframe: z.enum(['day', 'week', 'month', 'year']).optional(),
});
export const eventSchema = z.object({
    type: z.string(),
    data: z.record(z.any()),
});
export const createCommentSchema = z.object({
    content: z.string(),
    parentId: z.string().optional(),
});
export const updateCommentSchema = z.object({
    content: z.string(),
});
export const voteSchema = z.object({
    value: z.number().min(-1).max(1),
});
export const importPhoneContactsSchema = z.object({
    contacts: z.array(z.object({
        name: z.string(),
        phoneNumber: z.string(),
    })),
});
export const createSessionSchema = z.object({
    recipeId: z.string(),
    servings: z.number().optional(),
});
export const updateStepSchema = z.object({
    status: z.enum(['pending', 'in_progress', 'completed']),
    notes: z.string().optional(),
});
export const updateTimerSchema = z.object({
    status: z.enum(['running', 'paused', 'completed']),
    remainingTime: z.number().optional(),
});
export const addTipSchema = z.object({
    content: z.string(),
    category: z.string().optional(),
});
export const toggleTipSchema = z.object({
    tipId: z.string(),
});
export const socialLoginSchema = z.object({
    provider: z.enum(['google', 'facebook', 'apple']),
    token: z.string(),
});
//# sourceMappingURL=validation.js.map
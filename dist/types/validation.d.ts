import { z } from 'zod';
export interface ValidationSchema {
    body?: z.ZodType<any>;
    query?: z.ZodType<any>;
    params?: z.ZodType<any>;
}
export declare const ingredientsSchema: z.ZodObject<{
    ingredients: z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        amount: z.ZodNumber;
        unit: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        name: string;
        unit: string;
        amount: number;
    }, {
        name: string;
        unit: string;
        amount: number;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    ingredients: {
        name: string;
        unit: string;
        amount: number;
    }[];
}, {
    ingredients: {
        name: string;
        unit: string;
        amount: number;
    }[];
}>;
export declare const substitutionSchema: z.ZodObject<{
    ingredient: z.ZodString;
    amount: z.ZodNumber;
    unit: z.ZodString;
    preferences: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    unit: string;
    amount: number;
    ingredient: string;
    preferences?: string[] | undefined;
}, {
    unit: string;
    amount: number;
    ingredient: string;
    preferences?: string[] | undefined;
}>;
export declare const tipSchema: z.ZodObject<{
    recipeId: z.ZodString;
    content: z.ZodString;
}, "strip", z.ZodTypeAny, {
    content: string;
    recipeId: string;
}, {
    content: string;
    recipeId: string;
}>;
export declare const conversationSchema: z.ZodObject<{
    messages: z.ZodArray<z.ZodObject<{
        role: z.ZodEnum<["user", "assistant"]>;
        content: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        content: string;
        role: "user" | "assistant";
    }, {
        content: string;
        role: "user" | "assistant";
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    messages: {
        content: string;
        role: "user" | "assistant";
    }[];
}, {
    messages: {
        content: string;
        role: "user" | "assistant";
    }[];
}>;
export declare const searchSchema: z.ZodObject<{
    query: z.ZodString;
    filters: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
    page: z.ZodOptional<z.ZodNumber>;
    limit: z.ZodOptional<z.ZodNumber>;
    sort: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
}, "strip", z.ZodTypeAny, {
    query: string;
    page?: number | undefined;
    limit?: number | undefined;
    sort?: Record<string, any> | undefined;
    filters?: Record<string, any> | undefined;
}, {
    query: string;
    page?: number | undefined;
    limit?: number | undefined;
    sort?: Record<string, any> | undefined;
    filters?: Record<string, any> | undefined;
}>;
export declare const timeRangeSchema: z.ZodObject<{
    startDate: z.ZodOptional<z.ZodString>;
    endDate: z.ZodOptional<z.ZodString>;
    timeframe: z.ZodOptional<z.ZodEnum<["day", "week", "month", "year"]>>;
}, "strip", z.ZodTypeAny, {
    startDate?: string | undefined;
    endDate?: string | undefined;
    timeframe?: "year" | "week" | "day" | "month" | undefined;
}, {
    startDate?: string | undefined;
    endDate?: string | undefined;
    timeframe?: "year" | "week" | "day" | "month" | undefined;
}>;
export declare const eventSchema: z.ZodObject<{
    type: z.ZodString;
    data: z.ZodRecord<z.ZodString, z.ZodAny>;
}, "strip", z.ZodTypeAny, {
    data: Record<string, any>;
    type: string;
}, {
    data: Record<string, any>;
    type: string;
}>;
export declare const createCommentSchema: z.ZodObject<{
    content: z.ZodString;
    parentId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    content: string;
    parentId?: string | undefined;
}, {
    content: string;
    parentId?: string | undefined;
}>;
export declare const updateCommentSchema: z.ZodObject<{
    content: z.ZodString;
}, "strip", z.ZodTypeAny, {
    content: string;
}, {
    content: string;
}>;
export declare const voteSchema: z.ZodObject<{
    value: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    value: number;
}, {
    value: number;
}>;
export declare const importPhoneContactsSchema: z.ZodObject<{
    contacts: z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        phoneNumber: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        name: string;
        phoneNumber: string;
    }, {
        name: string;
        phoneNumber: string;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    contacts: {
        name: string;
        phoneNumber: string;
    }[];
}, {
    contacts: {
        name: string;
        phoneNumber: string;
    }[];
}>;
export declare const createSessionSchema: z.ZodObject<{
    recipeId: z.ZodString;
    servings: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    recipeId: string;
    servings?: number | undefined;
}, {
    recipeId: string;
    servings?: number | undefined;
}>;
export declare const updateStepSchema: z.ZodObject<{
    status: z.ZodEnum<["pending", "in_progress", "completed"]>;
    notes: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    status: "pending" | "completed" | "in_progress";
    notes?: string | undefined;
}, {
    status: "pending" | "completed" | "in_progress";
    notes?: string | undefined;
}>;
export declare const updateTimerSchema: z.ZodObject<{
    status: z.ZodEnum<["running", "paused", "completed"]>;
    remainingTime: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    status: "completed" | "running" | "paused";
    remainingTime?: number | undefined;
}, {
    status: "completed" | "running" | "paused";
    remainingTime?: number | undefined;
}>;
export declare const addTipSchema: z.ZodObject<{
    content: z.ZodString;
    category: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    content: string;
    category?: string | undefined;
}, {
    content: string;
    category?: string | undefined;
}>;
export declare const toggleTipSchema: z.ZodObject<{
    tipId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    tipId: string;
}, {
    tipId: string;
}>;
export declare const socialLoginSchema: z.ZodObject<{
    provider: z.ZodEnum<["google", "facebook", "apple"]>;
    token: z.ZodString;
}, "strip", z.ZodTypeAny, {
    token: string;
    provider: "google" | "facebook" | "apple";
}, {
    token: string;
    provider: "google" | "facebook" | "apple";
}>;
